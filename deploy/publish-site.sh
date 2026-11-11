#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

staging_dir="${PWD}/deploy/.site-build"
dist_dir="${PWD}/apps/site/dist"
old_assets_days=7

if ! command -v rsync >/dev/null 2>&1; then
  echo "o rsync é obrigatório para publicar o site: instale com sudo apt-get install -y rsync" >&2
  exit 1
fi

if [[ ! -f "${staging_dir}/index.html" ]]; then
  echo "nenhum site gerado em deploy/.site-build: rode antes bash deploy/build-site.sh" >&2
  exit 1
fi

mkdir -p "${dist_dir}"
rsync -a --exclude='*.html' "${staging_dir}/" "${dist_dir}/"
rsync -a --delete-after --exclude='/_astro/' "${staging_dir}/" "${dist_dir}/"

if [[ -d "${dist_dir}/_astro" ]]; then
  (cd "${dist_dir}/_astro" && find . -type f -mtime "+${old_assets_days}") | while IFS= read -r path; do
    if [[ ! -e "${staging_dir}/_astro/${path}" ]]; then
      rm -f "${dist_dir:?}/_astro/${path}"
    fi
  done
  find "${dist_dir}/_astro" -mindepth 1 -type d -empty -delete
fi

rm -rf "${staging_dir}"
echo "site publicado em apps/site/dist"
