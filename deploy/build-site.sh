#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

env_file="${1:-deploy/.env.prod}"
staging_dir="${PWD}/deploy/.site-build"

if [[ ! -f "${env_file}" ]]; then
  echo "arquivo não encontrado: ${env_file}" >&2
  exit 1
fi

domain="$(sed -n 's/^DOMAIN=//p' "${env_file}" | tail -n 1 | tr -d "\"'[:space:]")"
if [[ -z "${domain}" ]]; then
  echo "defina DOMAIN em ${env_file}" >&2
  exit 1
fi

build_dir="$(mktemp -d "${staging_dir}.XXXXXX")"
trap 'rm -rf "${build_dir}"' EXIT

SITE_URL="https://${domain}" pnpm --filter site exec astro build --outDir "${build_dir}"

rm -rf "${staging_dir}"
mv "${build_dir}" "${staging_dir}"
chmod 755 "${staging_dir}"

echo "site gerado para https://${domain} em deploy/.site-build (ainda não publicado)"
echo "publique com: bash deploy/publish-site.sh"
