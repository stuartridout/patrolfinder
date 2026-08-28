#!/usr/bin/env bash
#
# Deploy the wsjpatrol API into an Azure subscription.
#
#   ./deploy.sh                       first run: creates everything
#   ./deploy.sh --code-only           later runs: just ship the code
#
# Creates, in one resource group:
#   - a Storage Account (the Function App needs one anyway; the tally,
#     sign-ups, photo metadata and the image blobs all live in it)
#   - a Linux Consumption Function App on Node 20
#
# At this scale the Function App sits inside the free monthly grant and the
# storage account costs pennies. Nothing here needs a paid tier.
#
# Requires: az CLI, logged in, with the right subscription selected.
set -euo pipefail

RG="${RG:-rg-wsjpatrol}"
LOCATION="${LOCATION:-uksouth}"
APP="${APP:-wsjpatrol-api}"
STORAGE="${STORAGE:-stwsjpatrol}"
REUNION_ENDS="${REUNION_ENDS:-2026-09-06}"
ALLOWED_ORIGIN="${ALLOWED_ORIGIN:-https://wsjpatrol.com,https://www.wsjpatrol.com,https://stuartridout.github.io}"

CODE_ONLY=0
[ "${1:-}" = "--code-only" ] && CODE_ONLY=1

say(){ printf '\n\033[1;34m==>\033[0m %s\n' "$1"; }

if [ "$CODE_ONLY" -eq 0 ]; then
  say "Resource group $RG in $LOCATION"
  az group create --name "$RG" --location "$LOCATION" --output none

  say "Storage account $STORAGE"
  az storage account create \
    --name "$STORAGE" --resource-group "$RG" --location "$LOCATION" \
    --sku Standard_LRS --kind StorageV2 \
    --allow-blob-public-access false --min-tls-version TLS1_2 \
    --output none

  say "Function app $APP (Linux consumption, Node 20)"
  az functionapp create \
    --name "$APP" --resource-group "$RG" --storage-account "$STORAGE" \
    --consumption-plan-location "$LOCATION" \
    --runtime node --runtime-version 20 --functions-version 4 \
    --os-type Linux --output none

  # A long random token. Printed once, here, and then only known to whoever
  # ran this and whoever they give it to.
  ADMIN_TOKEN="${ADMIN_TOKEN:-$(head -c 32 /dev/urandom | base64 | tr -d '=+/' | cut -c1-40)}"

  say "App settings"
  az functionapp config appsettings set --name "$APP" --resource-group "$RG" --settings \
    "ADMIN_TOKEN=$ADMIN_TOKEN" \
    "REUNION_ENDS=$REUNION_ENDS" \
    "ALLOWED_ORIGIN=$ALLOWED_ORIGIN" \
    "SCM_DO_BUILD_DURING_DEPLOYMENT=true" \
    "ENABLE_ORYX_BUILD=true" \
    "WEBSITE_RUN_FROM_PACKAGE=" \
    --output none

  printf '\n\033[1;33mADMIN TOKEN (save this now, it is not shown again):\033[0m\n%s\n\n' "$ADMIN_TOKEN"
fi

say "Packaging"
ZIP="$(mktemp -d)/app.zip"
# node_modules is left out on purpose: Oryx installs it server-side from
# package.json, so the upload stays small and the platform picks the right
# native builds.
zip -qr "$ZIP" host.json package.json src -x '*/node_modules/*'

say "Deploying"
az functionapp deployment source config-zip \
  --name "$APP" --resource-group "$RG" --src "$ZIP" --build-remote true --output none

HOST=$(az functionapp show --name "$APP" --resource-group "$RG" --query defaultHostName -o tsv)

cat <<DONE

Deployed.

  API           https://$HOST
  Console       https://$HOST/admin
  Health check  curl https://$HOST/config

Next: put this in index.html and push to main.

  const API_BASE = "https://$HOST";

DONE
