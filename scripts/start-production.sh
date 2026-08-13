#!/bin/sh
set -eu

# During a rolling deployment, two containers can briefly ask Prisma for the
# same migration advisory lock. Retry that transient contention before Next.js
# starts instead of making Coolify replace an otherwise healthy container.
attempt=1
max_attempts=4

while ! ./node_modules/.bin/prisma migrate deploy; do
  if [ "$attempt" -ge "$max_attempts" ]; then
    echo "Prisma migrations failed after ${max_attempts} attempts." >&2
    exit 1
  fi

  wait_seconds=$((attempt * 5))
  echo "Prisma migration lock unavailable; retrying in ${wait_seconds}s (${attempt}/${max_attempts})." >&2
  sleep "$wait_seconds"
  attempt=$((attempt + 1))
done

exec ./node_modules/.bin/next start
