#!/bin/sh
set -e

echo "Waiting for database..."
until npx tsx node_modules/.bin/knex migrate:latest --knexfile knexfile.cjs; do
  echo "Migration failed, retrying in 2s..."
  sleep 2
done

echo "Migrations complete, starting server..."
exec "$@"
