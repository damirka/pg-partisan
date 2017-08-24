'use strict';

/**
 * CLI utilite to create and apply DB migrations
 * All of them are SQL files and sorted in date order.
 *
 * Possible commands:
 *
 * ```
 * # Create new migration file
 * $ partisan create <migration_name>
 *
 * # Apply all the pending migrations
 * $ partisan migrate
 * ```
 *
 * @module lib/partisan
 */

const path = require('path');
const fs   = require('fs');

// Colors are not used as variable as they
// update String.prototype
require('colors');

/**
 * Name of the create migration command
 *
 * @type {String}
 */
const CREATE_COMMAND = 'create';

/**
 * Name of the migration (applying migrations) command
 *
 * @type {String}
 */
const MIGRATE_COMMAND = 'migrate';

/**
 * Same as MIGRATE_COMMAND but some might find it more useful
 *
 * @type {String}
 */
const UP_COMMAND = 'up';

/**
 * Exit code for success
 *
 * @type {Number}
 */
const CODE_SUCCESS = 0;

/**
 * Exit code for error
 *
 * @type {Number}
 */
const CODE_ERROR = 1;

/**
 * Application directory to put migraions into
 *
 * @type {String}
 */
const MIGRATIONS_PATH = process.env.PARTISAN_MIGRATIONS_PATH || 'migrations';

/**
 * Name of the table to write migrations to
 *
 * @type {String}
 */
const MIGRATION_TABLE_NAME = process.env.PARTISAN_MIGRATIONS_TABLE_NAME || 'public.migrations';

/**
 * Trouble here - need to parse Boolean value from env
 * Defines whether to wrap migrations into transactions by default or not
 *
 * @type {Boolean}
 */
const USE_TRANSACTIONS = (process.env.PARTISAN_USE_TRANSACTIONS || 'true') === 'true' ? true : false;

/**
 * Schema for migrations table
 *
 * @type {String}
 */
const MIGRATIONS_TABLE_DEFINITION = [
    `CREATE TABLE IF NOT EXISTS ${MIGRATION_TABLE_NAME} (`,
    `    id          serial      PRIMARY KEY,`,
    `    name        text        UNIQUE,`,
    `    created_at  timestamptz DEFAULT NOW()`,
    `)`
].join('\n');

/**
 * Template for
 *
 * @type {String}
 */
const SQL_FILE_TEMPLATE = [
    '/**',
    ' * Don\'t forget to document your SQLs',
    ' */'
].join('\n');

/**
 * Environment-based DB configuration object
 *
 * @type {Object}
 */
const DB_CONFIG = {
    user:        process.env.PGUSER,
    database:    process.env.PGDATABASE,
    password:    process.env.PGPASSWORD,
    port:        process.env.PGPORT || 5432
};

/**
 * Command to call
 *
 * @type {String}
 */
const COMMAND = process.argv[2];

/**
 * Additional value to use when running command
 *
 * Now only used when running CREATE command
 *
 * @type {String}
 */
const VALUE = process.argv[3];

/**
 * Logger object with methods to run different types of output
 *
 * @type {Object}
 */
const log = {
    error()   { _log(arguments, 'red');    },
    warning() { _log(arguments, 'yellow'); },
    default() { _log(arguments, 'white');  },
    info()    { _log(arguments, 'blue');   },
    success() { _log(arguments, 'green');  }
};

/**
 * Run the command itself
 *
 * Yay!
 */
switch (COMMAND) {

    case CREATE_COMMAND:
        log.default('Trying to create migration...');
        createMigration(VALUE);
        break;

    case UP_COMMAND:
    case MIGRATE_COMMAND:
        log.default('Migrating...');
        applyMigrations();
        break;

    default:
        log.warning('No valid command specified');
}

/**
 * Create new migration file
 *
 * Path:        MIGRATIONS_PATH
 * Name format: yyyy_mm_dd_hhiiss_name
 *
 * Logs error when failed and success when created file
 *
 * @param  {String} name Name of the file to use when generating
 */
function createMigration(name) {

    let filename = getFileName(name);
    let dir      = path.resolve(MIGRATIONS_PATH);
    let filepath = `${dir}/${filename}.sql`;

    try {
        // Check whether directory exists
        fs.statSync(dir);
    } catch (err) {
        // If not exists -> create it
        if (err.code === 'ENOENT') {
            log.warning('Migration path does not exist, creating');
            fs.mkdirSync(dir);
        }
    }

    return fs.writeFile(filepath, SQL_FILE_TEMPLATE, 'utf-8', function (error) {
        return error
            ? log.error('Failed to create migration file', error)
            : log.success('Successfully created new migration', filename);
    });

    /**
     * Generate filename based on the current date and passed name
     *
     * Out format: yyyy_mm_dd_hhiiss_name
     *
     * @param  {String} name Custom name of the migration to create
     * @return {String}      Formatted filename
     */
    function getFileName(name) {
        let date = new Date();

        return [
            date.getFullYear(),
            n0(date.getMonth() + 1),
            n0(date.getDate()  + 1),
            [
                n0(date.getHours()),
                n0(date.getMinutes()),
                n0(date.getSeconds())
            ].join(''),
            name
        ].join('_');
    }

    /**
     * Adds leading 0 to numbers below 10
     *
     * @param  {Number} num Number to format
     * @return {String}     Formatted number
     */
    function n0(n) {
        return (+n < 10) ? '0' + n : n;
    }
}

/**
 * Apply migrations following this scheme:
 *
 * 1. Read all files in MIGRATIONS_PATH directory
 * 2. Select all applied files from MIGRATION_TABLE_NAME
 * 3. Find difference
 * 4, Sort in date order
 * 5. Apply migrations file by file
 *
 * Log success after each migration or error if any failed
 * Once one migration failed process stops execution
 */
function applyMigrations() {

    /**
     * pg.Client instance
     *
     * @type {Object}
     */
    const client = Reflect.construct(require('pg').Client, [DB_CONFIG]);

    return Promise.resolve()
        .then(() => client.connect())
        .then(() => client.query(MIGRATIONS_TABLE_DEFINITION))
        .then(() => client.query(`SELECT name FROM ${MIGRATION_TABLE_NAME}`))
        .then(({rows}) => {
            // Get only name column from selected rows
            let migrations = rows.map(({name}) => name);
            return migrate(migrations);
        })
        .catch((error) => log.error('Execution error', error) || process.exit(CODE_ERROR));

    /**
     * Find files that do not match
     *
     * @param  {Array}   applied Array of migrations that have already been applied
     * @return {Promise}
     */
    function migrate(applied) {
        let pending = getMigrationFiles(applied);

        // No pending migrations - exit
        if (pending.length === 0) {
            log.default('No pending migrations, exiting');
            process.exit(CODE_SUCCESS);
        }

        // Get pending files iterator
        let iterator = pending[Symbol.iterator]();
        let {value}  = iterator.next();

        return applyFile(value, iterator);
    }

    /**
     * Apply migation file
     *
     * @param  {String}   filename Name of the migration file to apply
     * @param  {Iterator} iterator Iterator to get next value
     * @return {Promise}
     */
    function applyFile(filename, iterator) {
        log.default('Applying migration', filename);

        return Promise.resolve()
            .then(() => USE_TRANSACTIONS && client.query(`BEGIN`))
            .then(() => client.query(getFileContents(filename)))
            .then(() => client.query(`INSERT INTO ${MIGRATION_TABLE_NAME} (name) VALUES ('${filename}')`))
            .then(() => USE_TRANSACTIONS && client.query(`COMMIT`))
            .then(() => log.success(`Migration ${filename} successfully applied`))
            .then(() => {
                let {value, done} = iterator.next();

                if (done || !value) {
                    log.info('No more migrations, exiting');
                    process.exit(CODE_SUCCESS);
                }

                return applyFile(value, iterator);
            })
            .catch((error) => {
                log.error(`Migration ${filename} failed, rollback`, error);
                Promise.resolve()
                    .then(() => USE_TRANSACTIONS && client.query(`ROLLBACK`))
                    .then(() => process.exit(CODE_ERROR));
            });
    }

    /**
     * Scans MIGRATIONS_PATH directory for file names
     *
     * @param  {Array} applied Array of migrations that have already been applied
     * @return {Array}         Array of files in MIGRATIONS_PATH directory
     */
    function getMigrationFiles(applied) {
        try {
            let files = fs.readdirSync(path.resolve(MIGRATIONS_PATH));
            files = files.filter((file) => /\.sql/.test(file));           // Get only .sql files
            files = files.map((file) => file.replace('.sql', ''));        // Remove .sql extension from files
            files = files.filter((file) => applied.indexOf(file) === -1); // Keep only not applied ones
            return files;
        } catch (error) {
            log.error('Got an error reading directory');
            throw error;
        }
    }

    /**
     * Reads SQL migration file contents
     *
     * @param  {String} filename Name of the migration file w/o extension
     * @return {String}          Contents of the SQL file
     */
    function getFileContents(filename) {
        try {
            return fs.readFileSync(path.resolve(`${MIGRATIONS_PATH}/${filename}.sql`)).toString();
        } catch (error) {
            log.error('Got an error reading file', filename);
            throw error;
        }
    }
}

/**
 * Log any information to STDOUT
 *
 * @param  {Array}  args  Array-like arguments object
 * @param  {String} color Name of the color to use
 */
function _log(args, color) {
    // Turn every element inro a string and color it
    args = [...args].map((el) => el.toString()[color]);

    // Apply date + arguments into console
    return console.log.apply(console, [`[${new Date().toUTCString()}]`].concat(args));
}
