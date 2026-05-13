#!/usr/bin/env bash
# =================================================================
# Meta / Instagram Graph API — helper script
# =================================================================
# Automates the curl dance after you've manually generated a
# short-lived user access token in the Graph API Explorer.
#
# Usage:
#   ./scripts/meta-helper.sh exchange  <APP_ID> <APP_SECRET> <SHORT_TOKEN>
#   ./scripts/meta-helper.sh pages     <LONG_TOKEN>
#   ./scripts/meta-helper.sh ig-id     <LONG_TOKEN> <FB_PAGE_ID>
#   ./scripts/meta-helper.sh all       <APP_ID> <APP_SECRET> <SHORT_TOKEN>
#
# The `all` subcommand chains everything: exchange short→long, list
# pages, then resolve the IG business account id for each page. Output
# is JSON-friendly so you can pipe it through jq if you want.
# -----------------------------------------------------------------

set -euo pipefail

API="https://graph.facebook.com/v22.0"

die() { echo "Error: $*" >&2; exit 1; }

cmd_exchange() {
  local app_id="${1:?missing APP_ID}"
  local app_secret="${2:?missing APP_SECRET}"
  local short_token="${3:?missing SHORT_TOKEN}"

  echo "--- Exchanging short-lived token for long-lived (60 days) ---" >&2
  curl -sS "${API}/oauth/access_token?grant_type=fb_exchange_token&client_id=${app_id}&client_secret=${app_secret}&fb_exchange_token=${short_token}"
  echo
}

cmd_pages() {
  local token="${1:?missing LONG_TOKEN}"
  echo "--- Listing Facebook Pages this user manages ---" >&2
  curl -sS "${API}/me/accounts?access_token=${token}"
  echo
}

cmd_ig_id() {
  local token="${1:?missing LONG_TOKEN}"
  local page_id="${2:?missing FB_PAGE_ID}"
  echo "--- Resolving Instagram Business Account ID for page ${page_id} ---" >&2
  curl -sS "${API}/${page_id}?fields=instagram_business_account&access_token=${token}"
  echo
}

cmd_all() {
  local app_id="${1:?missing APP_ID}"
  local app_secret="${2:?missing APP_SECRET}"
  local short_token="${3:?missing SHORT_TOKEN}"

  echo "================================================================="
  echo "Step 1/3 — Exchange short token for long-lived token"
  echo "================================================================="
  local long_token
  long_token=$(curl -sS "${API}/oauth/access_token?grant_type=fb_exchange_token&client_id=${app_id}&client_secret=${app_secret}&fb_exchange_token=${short_token}" \
    | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('access_token') or sys.exit('No access_token in response: '+str(d)))")
  echo "LONG_TOKEN=${long_token}"
  echo

  echo "================================================================="
  echo "Step 2/3 — Listing your Facebook Pages"
  echo "================================================================="
  local pages_json
  pages_json=$(curl -sS "${API}/me/accounts?access_token=${long_token}")
  echo "${pages_json}" | python3 -m json.tool
  echo

  echo "================================================================="
  echo "Step 3/3 — Resolving Instagram Business Account IDs"
  echo "================================================================="
  echo "${pages_json}" | python3 -c "
import sys, json, urllib.request
data = json.load(sys.stdin)
token = '${long_token}'
for p in data.get('data', []):
    pid, pname = p['id'], p['name']
    url = f'${API}/{pid}?fields=instagram_business_account&access_token={token}'
    with urllib.request.urlopen(url) as r:
        rj = json.loads(r.read())
    iba = rj.get('instagram_business_account', {}).get('id', '(none — page not linked to an IG business account)')
    print(f'  Page: {pname!r}')
    print(f'    FB_PAGE_ID={pid}')
    print(f'    IG_BUSINESS_ACCOUNT_ID={iba}')
"
  echo
  echo "================================================================="
  echo "Done. Paste these 3 values into the routine secrets:"
  echo "  META_LONG_LIVED_TOKEN = (the long token shown above)"
  echo "  FB_PAGE_ID            = (from the Page you want to use)"
  echo "  IG_BUSINESS_ACCOUNT_ID = (from the same Page)"
  echo "================================================================="
}

main() {
  local sub="${1:-}"
  shift || true
  case "$sub" in
    exchange) cmd_exchange "$@" ;;
    pages)    cmd_pages "$@" ;;
    ig-id)    cmd_ig_id "$@" ;;
    all)      cmd_all "$@" ;;
    *)
      cat >&2 <<USAGE
Usage:
  $0 exchange  <APP_ID> <APP_SECRET> <SHORT_TOKEN>
  $0 pages     <LONG_TOKEN>
  $0 ig-id     <LONG_TOKEN> <FB_PAGE_ID>
  $0 all       <APP_ID> <APP_SECRET> <SHORT_TOKEN>

Recommended: 'all' runs the full pipeline and prints the 3 secrets you need.
USAGE
      exit 2
      ;;
  esac
}

main "$@"
