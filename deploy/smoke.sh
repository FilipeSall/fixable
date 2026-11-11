#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

compose=(docker compose -p fixable-smoke --env-file deploy/.env.smoke -f deploy/compose.prod.yml -f deploy/compose.smoke.yml)
admin_email="admin-smoke-$(date +%s)@fixable.local"

cleanup() {
  local status=$?
  if (( status != 0 )); then
    "${compose[@]}" logs --tail 80 api web backup || true
  fi
  "${compose[@]}" down -v --remove-orphans
  exit "$status"
}
trap cleanup EXIT

SITE_URL=https://localhost pnpm build:site
"${compose[@]}" up -d --build --wait --wait-timeout 300

if "${compose[@]}" ps --format '{{.Ports}}' api db | grep -q -- '->'; then
  echo "a API e o banco não podem publicar portas no host" >&2
  exit 1
fi

"${compose[@]}" exec -T api node src/cli/create-admin.ts --nome "Admin Smoke" --email "$admin_email"

backup_ok=false
for _ in $(seq 1 30); do
  if "${compose[@]}" exec -T backup sh -c 'ls /backups/*.dump' >/dev/null 2>&1; then
    backup_ok=true
    break
  fi
  sleep 1
done
if [[ "$backup_ok" != true ]]; then
  echo "o backup inicial não foi gerado em /backups" >&2
  exit 1
fi
"${compose[@]}" exec -T backup sh -c 'ls -l /backups'

mailpit_address="$("${compose[@]}" port mailpit 8025)"

SMOKE_BASE_URL=https://localhost \
  SMOKE_MAILPIT_URL="http://${mailpit_address}" \
  SMOKE_ADMIN_EMAIL="$admin_email" \
  pnpm --filter site exec playwright test -c playwright.caddy.config.ts
