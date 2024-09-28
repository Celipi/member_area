#!/bin/bash

set -e

host="$1"
shift
cmd="$@"

timeout=60 # Tempo limite em segundos
count=0

until PGPASSWORD="Extreme123" psql -h "$host" -U "postgres" -c '\q'; do
  >&2 echo "PostgreSQL is unavailable - sleeping"
  sleep 1
  count=$((count + 1))
  if [ $count -gt $timeout ]; then
    >&2 echo "Error: PostgreSQL did not start within the timeout."
    exit 1
  fi
done

>&2 echo "PostgreSQL is up - executing command"
$cmd