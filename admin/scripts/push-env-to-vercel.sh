#!/usr/bin/env bash
#
# Copies every variable in admin/.env.local into the linked Vercel project, for
# production, preview and development.
#
#   npm i -g vercel
#   vercel login
#   cd admin && vercel link
#   ./scripts/push-env-to-vercel.sh
#
# Values are piped in from a temp file rather than echoed, so no secret ever
# lands in your shell history. Vercel stores production and preview variables as
# "sensitive" by default, meaning they cannot be read back out of the dashboard.
set -euo pipefail

cd "$(dirname "$0")/.."

ENV_FILE=".env.local"
[ -f "$ENV_FILE" ] || { echo "No $ENV_FILE here. Run this from admin/."; exit 1; }

command -v vercel >/dev/null || { echo "Vercel CLI missing. Run: npm i -g vercel"; exit 1; }
[ -d ".vercel" ] || { echo "Project not linked. Run: vercel link"; exit 1; }

TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT

while IFS= read -r line; do
  # Skip comments and blanks
  case "$line" in ''|\#*) continue ;; esac
  name=${line%%=*}
  value=${line#*=}
  [ -n "$name" ] && [ -n "$value" ] || continue

  printf '%s' "$value" > "$TMP"

  # Development has to be a separate call: Vercel rejects it being combined
  # with production or preview in one command.
  for target in production preview development; do
    if vercel env add "$name" "$target" --force < "$TMP" >/dev/null 2>&1; then
      echo "  set $name -> $target"
    else
      echo "  FAILED $name -> $target"
    fi
  done
done < "$ENV_FILE"

echo
echo "Done. Environment variables only apply to NEW deployments, so redeploy:"
echo "  vercel --prod"
