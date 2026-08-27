#!/bin/sh
set -eu

# Auth.js must use the public origin exposed by Coolify. A stale internal
# NEXTAUTH_URL (for example https://localhost:80) makes PIN login fail in the
# browser even though the application itself is healthy.
if [ -n "${NEXT_PUBLIC_APP_URL:-}" ]; then
  public_app_url="${NEXT_PUBLIC_APP_URL%/}"
  export AUTH_URL="$public_app_url"
  export NEXTAUTH_URL="$public_app_url"
  export AUTH_TRUST_HOST=true
fi

# A rolling deployment briefly runs the old and the new container together.
# Do not ask PostgreSQL for Prisma's migration advisory lock when all local
# migrations are already applied: that was making otherwise healthy deploys
# wait for the lock and occasionally fail with P1002.
if ./node_modules/.bin/prisma migrate status; then
  echo "Prisma schema already up to date; migration deploy skipped."
else
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
fi

exec ./node_modules/.bin/next start
