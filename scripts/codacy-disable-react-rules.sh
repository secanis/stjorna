#!/usr/bin/env bash
# Disable Codacy's false-positive ESLint patterns for STJÓRNA.
#
# Codacy's stock ESLint config applies eslint-plugin-react to every .tsx
# file, which fires on SolidJS-only code (no React import, `class` not
# `className`). The same goes for eslint-plugin-i18next (we have no i18n
# wired up — tracked in #183) and eslint-plugin-compat (we target modern
# evergreen browsers only). These rules are STJÓRNA-stack noise that we
# want silenced in Codacy without giving up ESLint coverage entirely.
#
# Two ways to do this:
#
# 1. RECOMMENDED — frontend/.eslintrc.yml + "Configuration file" toggle
#    in Codacy UI:
#      - Open https://app.codacy.com/gh/secanis/stjorna/code-patterns
#      - Click on ESLint → toggle "Configuration file" ON
#      - Re-analyze PRs (Codacy does this on the next push)
#    The .eslintrc.yml is committed and travels with the code. No API
#    token needed.
#
# 2. ALTERNATIVE — bulk-disable patterns via the Codacy API:
#      CODACY_API_TOKEN=… ./scripts/codacy-disable-react-rules.sh
#    This script walks the ESLint tool's patterns and disables every
#    one whose ID starts with `react_`, `i18next_`, or `compat_`. Useful
#    if you can't / won't toggle "Configuration file" mode.
#
# Both approaches produce the same end-state for STJÓRNA — eslint
# warnings go away in Codacy. Option 1 is preferable because the config
# lives in the repo; option 2 is a UI-side setting that drifts if not
# documented.

set -euo pipefail

if [[ -z "${CODACY_API_TOKEN:-}" ]]; then
    echo "CODACY_API_TOKEN is required. Get one at https://app.codacy.com/account/api-tokens" >&2
    exit 1
fi

PROVIDER="gh"
ORG="secanis"
REPO="stjorna"

# ESLint tool UUID on Codacy. Hardcoded — verifiable with:
#   curl -s -H "api-token: $CODACY_API_TOKEN" \
#     "https://api.codacy.com/api/v3/analysis/organizations/$PROVIDER/$ORG/repositories/$REPO/tools"
TOOL_UUID="f8b29663-2cb2-498d-b923-a10c6a8c05cd"

# Patterns whose IDs match these prefixes are STJÓRNA-stack noise.
NOISE_PREFIXES=("react_" "i18next_" "compat_")

API_BASE="https://api.codacy.com/api/v3/analysis/organizations/$PROVIDER/$ORG/repositories/$REPO/tools/$TOOL_UUID"

echo "Fetching ESLint pattern IDs from $API_BASE ..."
PATTERNS=$(curl -sS \
    -H "api-token: $CODACY_API_TOKEN" \
    "$API_BASE/patterns" \
    | python3 -c '
import json, sys
d = json.load(sys.stdin)
for p in d.get("data", []):
    print(p["patternInfo"]["id"])
')

if [[ -z "$PATTERNS" ]]; then
    echo "No patterns returned — check your API token and that ESLint is enabled in Codacy." >&2
    exit 1
fi

DISABLED=0
KEPT=0
while IFS= read -r pid; do
    [[ -z "$pid" ]] && continue
    matched=0
    for prefix in "${NOISE_PREFIXES[@]}"; do
        if [[ "$pid" == "$prefix"* ]]; then
            matched=1
            break
        fi
    done
    if (( matched == 1 )); then
        echo "  disable  $pid"
        curl -sS -X PUT \
            -H "api-token: $CODACY_API_TOKEN" \
            -H "Content-Type: application/json" \
            -d '{"enabled": false}' \
            "$API_BASE/patterns/$pid" > /dev/null
        DISABLED=$((DISABLED + 1))
    else
        KEPT=$((KEPT + 1))
    fi
done <<< "$PATTERNS"

echo
echo "Done. Disabled $DISABLED patterns, kept $KEPT."
echo "Trigger a re-analysis from the PR page or push a new commit to verify."
