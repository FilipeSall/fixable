#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

work_dir="$(mktemp -d -t fixable-compose-XXXXXX)"
trap 'rm -rf "${work_dir}"' EXIT

api_rate_limits() {
  env -u TOKEN_RATE_LIMIT -u LOGIN_RATE_LIMIT docker compose -p fixable-compose-check "$@" config --format json |
    node -e '
      const { environment } = JSON.parse(require("node:fs").readFileSync(0, "utf8")).services.api;
      process.stdout.write(`TOKEN_RATE_LIMIT=${environment.TOKEN_RATE_LIMIT} LOGIN_RATE_LIMIT=${environment.LOGIN_RATE_LIMIT}`);
    '
}

expect_rate_limits() {
  local label="$1" expected="$2"
  shift 2
  local actual
  actual="$(api_rate_limits "$@")"
  if [[ "${actual}" != "${expected}" ]]; then
    echo "${label}: esperado ${expected}, obtido ${actual}" >&2
    exit 1
  fi
  echo "${label}: ${actual}"
}

grep -Ev '^(TOKEN|LOGIN)_RATE_LIMIT=' deploy/.env.prod.example > "${work_dir}/sem-limites.env"

expect_rate_limits "produção sem as variáveis" "TOKEN_RATE_LIMIT=20 LOGIN_RATE_LIMIT=10" \
  --env-file "${work_dir}/sem-limites.env" -f deploy/compose.prod.yml
expect_rate_limits "produção com o .env.prod.example" "TOKEN_RATE_LIMIT=20 LOGIN_RATE_LIMIT=10" \
  --env-file deploy/.env.prod.example -f deploy/compose.prod.yml
expect_rate_limits "smoke" "TOKEN_RATE_LIMIT=1000 LOGIN_RATE_LIMIT=1000" \
  --env-file deploy/.env.smoke -f deploy/compose.prod.yml -f deploy/compose.smoke.yml
