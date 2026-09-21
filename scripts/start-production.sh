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

# The cashier only asks for the first two PIN digits. Keep a keyed lookup for
# that prefix so profile access never brute-forces up to one million PINs.
node ./scripts/backfill-pin-prefix-lookups.mjs

# Keep the Node heap below the point where the host OOM killer starts taking
# down unrelated services. Native allocations still need headroom, so the
# default is intentionally lower than the deployment server's total memory.
runtime_heap_mb="${RUNTIME_MAX_OLD_SPACE_MB:-1024}"
case " ${NODE_OPTIONS:-} " in
  *" --max-old-space-size="*) ;;
  *) export NODE_OPTIONS="${NODE_OPTIONS:+${NODE_OPTIONS} }--max-old-space-size=${runtime_heap_mb}" ;;
esac

# Docker marks an unhealthy container but does not restart it by itself. Keep
# a tiny PID 1 supervisor alive so a killed or wedged Next.js process recovers
# inside the same container and Traefik can route traffic to it again.
health_start_delay="${APP_HEALTH_START_DELAY_SECONDS:-15}"
health_interval="${APP_HEALTH_INTERVAL_SECONDS:-10}"
health_failures_before_restart="${APP_HEALTH_FAILURES_BEFORE_RESTART:-3}"
health_url="http://127.0.0.1:${PORT:-3000}/api/health"
shutdown_requested=0
server_pid=""
watchdog_pid=""

stop_children() {
  shutdown_requested=1
  if [ -n "$watchdog_pid" ]; then
    kill "$watchdog_pid" 2>/dev/null || true
  fi
  if [ -n "$server_pid" ]; then
    kill -TERM "$server_pid" 2>/dev/null || true
  fi
}

trap stop_children INT TERM HUP

restart_delay=2
while [ "$shutdown_requested" -eq 0 ]; do
  echo "Starting Next.js with a ${runtime_heap_mb} MB V8 heap limit."
  ./node_modules/.bin/next start &
  server_pid=$!

  (
    sleep "$health_start_delay"
    failed_checks=0

    while kill -0 "$server_pid" 2>/dev/null; do
      if curl --fail --silent --show-error --connect-timeout 2 --max-time 5 "$health_url" >/dev/null; then
        failed_checks=0
      else
        failed_checks=$((failed_checks + 1))
        echo "Application health check failed (${failed_checks}/${health_failures_before_restart})." >&2
      fi

      if [ "$failed_checks" -ge "$health_failures_before_restart" ]; then
        echo "Application remained unhealthy; restarting Next.js automatically." >&2
        kill -TERM "$server_pid" 2>/dev/null || true
        sleep 8
        kill -KILL "$server_pid" 2>/dev/null || true
        exit 0
      fi

      sleep "$health_interval"
    done
  ) &
  watchdog_pid=$!

  server_exit_code=0
  wait "$server_pid" || server_exit_code=$?
  kill "$watchdog_pid" 2>/dev/null || true
  wait "$watchdog_pid" 2>/dev/null || true
  server_pid=""
  watchdog_pid=""

  if [ "$shutdown_requested" -ne 0 ]; then
    exit 0
  fi

  echo "Next.js stopped unexpectedly (exit ${server_exit_code}); restarting in ${restart_delay}s." >&2
  sleep "$restart_delay"
  if [ "$restart_delay" -lt 30 ]; then
    restart_delay=$((restart_delay * 2))
    if [ "$restart_delay" -gt 30 ]; then
      restart_delay=30
    fi
  fi
done
