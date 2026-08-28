#!/usr/bin/env bash
#
# Deploy the wsjpatrol API into an Azure subscription.
#
#   ./deploy.sh                  first run: creates everything, then ships the code
#   ./deploy.sh --code-only      later runs: just ship the code
#   ./deploy.sh --yes            skip the confirmation prompt
#
# Creates, in one new resource group and nothing else:
#   - a Storage Account (the Function App needs one anyway; the tally,
#     sign-ups, photo metadata and the image blobs all live in it)
#   - a Linux Consumption Function App on Node 24
#
# At this scale the Function App sits inside the free monthly grant and the
# storage account costs pennies. Nothing here needs a paid tier.
#
# Requires: az CLI, logged in. Run it from a machine your tenant's Conditional
# Access is happy with, which usually means your own laptop rather than a
# container: device-code sign-in is commonly blocked outright.
set -euo pipefail

RG="${RG:-rg-wsjpatrol}"
LOCATION="${LOCATION:-uksouth}"
APP="${APP:-wsjpatrol-api}"
STORAGE="${STORAGE:-stwsjpatrol}"
REUNION_ENDS="${REUNION_ENDS:-2026-09-06}"
ALLOWED_ORIGIN="${ALLOWED_ORIGIN:-https://wsjpatrol.com,https://www.wsjpatrol.com,https://stuartridout.github.io}"

CODE_ONLY=0
ASSUME_YES=0
for arg in "$@"; do
  case "$arg" in
    --code-only) CODE_ONLY=1 ;;
    --yes|-y)    ASSUME_YES=1 ;;
    *) echo "unknown argument: $arg" >&2; exit 2 ;;
  esac
done

say(){ printf '\n\033[1;34m==>\033[0m %s\n' "$1"; }

command -v az  >/dev/null || { echo "az CLI not found. https://aka.ms/azcli" >&2; exit 1; }
command -v zip >/dev/null || { echo "zip not found." >&2; exit 1; }

SUB_NAME=$(az account show --query name -o tsv)
SUB_ID=$(az account show --query id -o tsv)

cat <<BANNER

  Subscription   $SUB_NAME
                 $SUB_ID
  Resource group $RG   (created if missing)
  Location       $LOCATION
  Function app   $APP
  Storage        $STORAGE
  Reunion ends   $REUNION_ENDS   (photos deleted seven days later)

Nothing outside that resource group is touched, and nothing is deleted.
BANNER

if [ "$ASSUME_YES" -eq 0 ]; then
  read -r -p "Go ahead? [y/N] " reply
  case "$reply" in y|Y|yes|YES) ;; *) echo "Stopped."; exit 0 ;; esac
fi

if [ "$CODE_ONLY" -eq 0 ]; then
  # A fresh subscription often has these unregistered, and the create then
  # fails with an unhelpful error. Registering is idempotent.
  for ns in Microsoft.Storage Microsoft.Web Microsoft.Insights; do
    state=$(az provider show --namespace "$ns" --query registrationState -o tsv 2>/dev/null || echo "NotRegistered")
    if [ "$state" != "Registered" ]; then
      say "Registering $ns (one-off, can take a minute)"
      az provider register --namespace "$ns" --wait
    fi
  done

  say "Resource group $RG in $LOCATION"
  az group create --name "$RG" --location "$LOCATION" --output none

  say "Storage account $STORAGE"
  az storage account create \
    --name "$STORAGE" --resource-group "$RG" --location "$LOCATION" \
    --sku Standard_LRS --kind StorageV2 \
    --allow-blob-public-access false --min-tls-version TLS1_2 \
    --output none

  say "Function app $APP (Linux consumption, Node 24)"
  az functionapp create \
    --name "$APP" --resource-group "$RG" --storage-account "$STORAGE" \
    --consumption-plan-location "$LOCATION" \
    --runtime node --runtime-version 24 --functions-version 4 \
    --os-type Linux --disable-app-insights true \
    --output none

  # A long random token. Printed once, below, and after that only readable by
  # someone with Azure access to the app's settings.
  ADMIN_TOKEN="${ADMIN_TOKEN:-$(head -c 32 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | cut -c1-40)}"

  say "App settings"
  az functionapp config appsettings set --name "$APP" --resource-group "$RG" --settings \
    "ADMIN_TOKEN=$ADMIN_TOKEN" \
    "REUNION_ENDS=$REUNION_ENDS" \
    "ALLOWED_ORIGIN=$ALLOWED_ORIGIN" \
    "SCM_DO_BUILD_DURING_DEPLOYMENT=true" \
    "ENABLE_ORYX_BUILD=true" \
    --output none
fi

say "Packaging"
TMPDIR_=$(mktemp -d)
ZIP="$TMPDIR_/app.zip"
# node_modules is left out on purpose: Oryx installs it server-side from
# package.json, so the upload stays small and the platform picks the right
# native builds.
zip -qr "$ZIP" host.json package.json src -x '*/node_modules/*'

say "Deploying (the server-side npm install takes a minute or two)"
az functionapp deployment source config-zip \
  --name "$APP" --resource-group "$RG" --src "$ZIP" --build-remote true --output none
rm -rf "$TMPDIR_"

HOST=$(az functionapp show --name "$APP" --resource-group "$RG" --query defaultHostName -o tsv)

say "Checking it answers"
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS "https://$HOST/config" >/dev/null 2>&1; then
    echo "  up"
    break
  fi
  [ "$i" = "10" ] && echo "  no answer yet - cold start can take a while, try the URL below in a minute"
  sleep 15
done

cat <<DONE

Deployed.

  API           https://$HOST
  Console       https://$HOST/admin
  Health check  curl https://$HOST/config

Put this in index.html and push to main:

  const API_BASE = "https://$HOST";

DONE

if [ "$CODE_ONLY" -eq 0 ]; then
  cat <<TOKEN
Admin token for the console. Save it now - this is the only time it is shown.
Anyone with Azure access can read it back later with:

  az functionapp config appsettings list -n $APP -g $RG --query "[?name=='ADMIN_TOKEN'].value" -o tsv

$ADMIN_TOKEN

TOKEN
fi
