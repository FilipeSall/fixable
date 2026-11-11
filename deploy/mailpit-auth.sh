#!/usr/bin/env bash
set -euo pipefail

usuario="${1:-}"
if [[ ! "${usuario}" =~ ^[A-Za-z0-9._-]+$ ]]; then
  echo "uso: bash deploy/mailpit-auth.sh <usuario>   (só letras, números, ponto, hífen e sublinhado)" >&2
  exit 1
fi

read -rsp "Senha da caixa de e-mails: " senha
echo >&2
if [[ ${#senha} -lt 8 ]]; then
  echo "use uma senha com pelo menos 8 caracteres" >&2
  exit 1
fi

hash="$(printf '%s\n' "${senha}" | docker run --rm -i caddy:2 caddy hash-password --bcrypt-cost 10 | tail -n 1)"
echo "Copie a linha abaixo para o deploy/.env.prod:" >&2
printf "MAILPIT_UI_AUTH='%s:%s'\n" "${usuario}" "${hash}"
