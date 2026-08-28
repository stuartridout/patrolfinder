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
command -v npm >/dev/null || { echo "npm not found. brew install node" >&2; exit 1; }

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

  # A brand new app answers plain HTTP as well as HTTPS. The admin token
  # travels on these requests, so redirect everything.
  say "HTTPS only"
  az functionapp update --name "$APP" --resource-group "$RG" --set httpsOnly=true --output none

  say "App settings"
  az functionapp config appsettings set --name "$APP" --resource-group "$RG" --settings \
    "ADMIN_TOKEN=$ADMIN_TOKEN" \
    "REUNION_ENDS=$REUNION_ENDS" \
    "ALLOWED_ORIGIN=$ALLOWED_ORIGIN" \
    --output none
fi

say "Installing dependencies"
# Shipped in the zip rather than built server-side. A Linux Consumption app has
# only a stub of a Kudu site, so the remote-build path (config-zip
# --build-remote) has nothing to build on and answers 503 forever.
npm install --omit=dev --no-audit --no-fund --silent

say "Packaging"
TMPDIR_=$(mktemp -d)
ZIP="$TMPDIR_/app.zip"
zip -qr "$ZIP" host.json package.json node_modules src

say "Uploading the package"
# Run-from-package: the app mounts a zip out of blob storage read-only. This is
# the deployment path Linux Consumption actually supports, and it never touches
# the SCM site.
KEY=$(az storage account keys list --account-name "$STORAGE" --resource-group "$RG" --query "[0].value" -o tsv)
az storage container create --name deployments \
  --account-name "$STORAGE" --account-key "$KEY" --output none
BLOB="app-$(date -u +%Y%m%d%H%M%S).zip"
az storage blob upload --file "$ZIP" --name "$BLOB" --container-name deployments \
  --account-name "$STORAGE" --account-key "$KEY" --overwrite --output none
rm -rf "$TMPDIR_"

# Long-lived read-only link, and BSD and GNU date disagree about how to say it.
EXPIRY=$(date -u -v+2y '+%Y-%m-%dT%H:%MZ' 2>/dev/null || date -u -d '+2 years' '+%Y-%m-%dT%H:%MZ')
PKG_URL=$(az storage blob generate-sas --name "$BLOB" --container-name deployments \
  --account-name "$STORAGE" --account-key "$KEY" \
  --permissions r --expiry "$EXPIRY" --https-only --full-uri -o tsv)

say "Pointing the app at it"
# Nothing is built on the way in any more, so this setting must not linger.
az functionapp config appsettings delete --name "$APP" --resource-group "$RG" \
  --setting-names SCM_DO_BUILD_DURING_DEPLOYMENT --output none 2>/dev/null || true
az functionapp config appsettings set --name "$APP" --resource-group "$RG" \
  --settings "WEBSITE_RUN_FROM_PACKAGE=$PKG_URL" --output none

say "Restarting"
az functionapp restart --name "$APP" --resource-group "$RG" --output none
sleep 15

say "Syncing triggers"
# Setting WEBSITE_RUN_FROM_PACKAGE by hand does not tell the platform what
# triggers the package contains. config-zip would have done this for us. Without
# it the scale controller has nothing to start, function list answers Bad
# Request, and every request to the app comes back 503 forever.
SYNC_URI="https://management.azure.com/subscriptions/$SUB_ID/resourceGroups/$RG/providers/Microsoft.Web/sites/$APP/syncfunctiontriggers?api-version=2022-03-01"
for attempt in 1 2 3 4; do
  if az rest --method post --uri "$SYNC_URI" --output none 2>/dev/null; then
    echo "  triggers synced"
    break
  fi
  echo "  sync attempt $attempt did not take, waiting 20s"
  sleep 20
done

HOST=$(az functionapp show --name "$APP" --resource-group "$RG" --query defaultHostName -o tsv)

say "Checking it answers"
up=0
for i in $(seq 1 24); do
  if curl -fsS "https://$HOST/config" >/dev/null 2>&1; then
    echo "  up after $((i * 15))s"
    up=1
    break
  fi
  sleep 15
done
[ "$up" = "1" ] || echo "  still quiet after six minutes - check the URL below, and the app's Log stream in the portal"

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
