#!/usr/bin/env bash
# Prueba la bandeja sin n8n: sube un PDF como lo haría el flujo.
# Uso:
#   SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=... GATITO_USUARIO_ID=... \
#     ./automatizacion/subir-a-bandeja.sh 10.10-GATITOSHOP.pdf
# La service_role es secreta: úsala solo en tu terminal o en n8n, nunca en la app ni en git.
set -euo pipefail
archivo="${1:?Indica el PDF a subir}"
: "${SUPABASE_URL:?Falta SUPABASE_URL}"
: "${SUPABASE_SERVICE_ROLE_KEY:?Falta SUPABASE_SERVICE_ROLE_KEY}"
: "${GATITO_USUARIO_ID:?Falta GATITO_USUARIO_ID (Ajustes → Tu cuenta)}"
nombre="$(date +%Y%m%d-%H%M%S)-$(basename "$archivo" | tr -c 'A-Za-z0-9._-' '_')"
curl --fail-with-body -sS -X POST \
  "$SUPABASE_URL/storage/v1/object/bandeja/$GATITO_USUARIO_ID/$nombre" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/pdf" \
  -H "x-upsert: true" \
  --data-binary "@$archivo"
echo
echo "Listo: abre la app y verás el aviso de la bandeja."
