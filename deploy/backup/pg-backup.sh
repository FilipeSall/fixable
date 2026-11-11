#!/usr/bin/env bash
set -euo pipefail

backup_dir=/backups
retention_days="${BACKUP_RETENTION_DAYS:-7}"
backup_time="${BACKUP_TIME:-03:00}"

run_backup() {
  local file
  file="${backup_dir}/${PGDATABASE}-$(date +%Y%m%d-%H%M%S).dump"
  if ! pg_dump --format=custom --file="${file}.partial"; then
    rm -f "${file}.partial"
    echo "backup falhou: ${file}" >&2
    return 1
  fi
  mv "${file}.partial" "${file}"
  find "${backup_dir}" -maxdepth 1 -type f -name "${PGDATABASE}-*.dump" -mtime "+$((retention_days - 1))" -delete
  echo "backup concluído: ${file}"
}

seconds_until_next_run() {
  local now next
  now="$(date +%s)"
  next="$(date -d "today ${backup_time}" +%s)"
  if (( next <= now )); then
    next="$(date -d "tomorrow ${backup_time}" +%s)"
  fi
  echo $(( next - now ))
}

validate_settings() {
  if [[ ! "${retention_days}" =~ ^[1-9][0-9]*$ ]]; then
    echo "BACKUP_RETENTION_DAYS precisa ser um número inteiro maior ou igual a 1 (recebido: '${retention_days}')" >&2
    exit 1
  fi
  if [[ ! "${backup_time}" =~ ^([01][0-9]|2[0-3]):[0-5][0-9]$ ]]; then
    echo "BACKUP_TIME precisa estar no formato HH:MM, de 00:00 a 23:59 (recebido: '${backup_time}')" >&2
    exit 1
  fi
}

validate_settings
rm -f "${backup_dir}"/*.partial

trap 'exit 0' TERM INT

until pg_isready --quiet; do
  sleep 2
done

run_backup || true
while true; do
  sleep "$(seconds_until_next_run)" &
  wait $!
  run_backup || true
done
