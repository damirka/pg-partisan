## pg-partisan

Partisan (pg-partisan in npm) is CLI migration tool for NodeJS and PostgreSQL

## Features

- Easy to install and use
- Creates and executes raw SQL files
- Sets up from the environment
- Only two commands: *create* and *migrate*
- Wraps every migration into a transaction block by default
- Console output is colored, yay!

## Install

You can install it globally via npm:
```sh
$ npm install --global pg-partisan
$ partisan create my_awesome_migration
```

Or use it as dependency of your project:
```sh
$ npm install --save pg-partisan
$ ./node_modules/.bin/partisan create new_migration_123
```

## Use

There are only two commands partisan accepts:

### *partisan create [migration_name]*

Creates new SQL file inside *migrations* folder (see options). If folder does not exist it creates one.

### *partisan migrate* | *partisan up*

Look through *migrations* folder and find not yet applied files, then apply them one by one within a transaction.
Yeah, it only supports up-migrations. But have you ever used down ones?

## Configuration:

All partisan configuration is taken from environment, no config files.

### Connection

For PostgreSQL connection options partisan uses default PostgreSQL env variables:

```sh
$ export PGUSER=postgres
$ export PGDATABASE=mydb
$ export PGPASSWORD=postgres
$ export PGPORT=5432
```

All of them are also described in *[brianc/node-postgres](https://github.com/brianc/node-postgres)* repository.

### Partisan options

Partisan supports following env settings (values in examples are default):

```sh
# Migration directory (relative to script execution path or absolute)
$ export PARTISAN_MIGRATIONS_PATH=migrations

# Table name (better with schema) where migrations data is stored
$ export PARTISAN_MIGRATIONS_TABLE_NAME=public.migrations

# Whether to use transactions (true|false)
$ export PARTISAN_USE_TRANSACTIONS=true
```

## Examples of usage and output

```sh
$ partisan create create_db_schema
[Thu, 01 Jan 1970 00:00:00 GMT] Trying to create migration...
[Thu, 01 Jan 1970 00:00:00 GMT] Migration path does not exist, creating...
[Thu, 01 Jan 1970 00:00:00 GMT] Migration directory created
[Thu, 01 Jan 1970 00:00:00 GMT] Successfully created new migration 1970_01_01_000000_setup_db_schema
```

```sh
$ PARTISAN_USE_TRANSACTIONS=false partisan migrate
[Thu, 01 Jan 1970 00:00:00 GMT] Migrating...
[Thu, 01 Jan 1970 00:00:00 GMT] Applying migration 1970_01_01_000000_setup_db_schema
[Thu, 01 Jan 1970 00:00:00 GMT] Migration 1970_01_01_000000_setup_db_schema successfully applied
[Thu, 01 Jan 1970 00:00:00 GMT] No more migrations, exiting
```

## For developers

Feel free to open issues or suggest pull requests. Haven't tested it well yet so any help is appreciated.

If you find it boring to look through 400 lines of code you can generate docs for it locally:
```sh
$ npm run generate-docs
$ google-chrome doc/index.html # if chrome installed
```
