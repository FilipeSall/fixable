#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

staging_dir="${PWD}/deploy/.site-build"
dist_dir="${PWD}/apps/site/dist"

if [[ ! -f "${staging_dir}/index.html" ]]; then
  echo "nenhum site gerado em deploy/.site-build: rode antes bash deploy/build-site.sh" >&2
  exit 1
fi

mkdir -p "${dist_dir}"
if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete-after "${staging_dir}/" "${dist_dir}/"
else
  cp -a "${staging_dir}/." "${dist_dir}/"
  (cd "${dist_dir}" && find . -mindepth 1 -depth) | while IFS= read -r path; do
    if [[ ! -e "${staging_dir}/${path}" && ! -L "${staging_dir}/${path}" ]]; then
      rm -rf "${dist_dir:?}/${path}"
    fi
  done
fi

rm -rf "${staging_dir}"
echo "site publicado em apps/site/dist"
