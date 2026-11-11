#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

env_file="${1:-deploy/.env.prod}"
dist_dir="${PWD}/apps/site/dist"

if [[ ! -f "${env_file}" ]]; then
  echo "arquivo não encontrado: ${env_file}" >&2
  exit 1
fi

domain="$(sed -n 's/^DOMAIN=//p' "${env_file}" | tail -n 1 | tr -d "\"'[:space:]")"
if [[ -z "${domain}" ]]; then
  echo "defina DOMAIN em ${env_file}" >&2
  exit 1
fi

build_dir="$(mktemp -d -t fixable-site-XXXXXX)"
trap 'rm -rf "${build_dir}"' EXIT

SITE_URL="https://${domain}" pnpm --filter site exec astro build --outDir "${build_dir}"

mkdir -p "${dist_dir}"
if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete-after "${build_dir}/" "${dist_dir}/"
else
  cp -a "${build_dir}/." "${dist_dir}/"
  (cd "${dist_dir}" && find . -mindepth 1 -depth) | while IFS= read -r path; do
    if [[ ! -e "${build_dir}/${path}" && ! -L "${build_dir}/${path}" ]]; then
      rm -rf "${dist_dir:?}/${path}"
    fi
  done
fi

echo "site gerado para https://${domain} em apps/site/dist"
