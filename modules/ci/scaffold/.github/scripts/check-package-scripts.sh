#!/usr/bin/env bash
# Assert every workspace package defines the required scripts (typecheck,
# lint, test). Fails the build at PR time when someone adds a package
# without wiring up the test runner.
#
# Detects workspace packages by walking the repo for package.json files
# (excluding node_modules and the root package.json). Adjust REQUIRED if
# the kit's convention changes.

set -euo pipefail

REQUIRED=("typecheck" "lint" "test")

# Find every package.json that isn't the workspace root or inside
# node_modules. The root package.json is the workspace manifest and is
# not expected to define typecheck/lint/test itself.
mapfile -t packages < <(
  find . -name package.json \
    -not -path "*/node_modules/*" \
    -not -path "./package.json" \
    | sort
)

if [[ ${#packages[@]} -eq 0 ]]; then
  echo "No workspace packages found. Are you running this from the repo root?"
  exit 1
fi

missing=0
for pkg in "${packages[@]}"; do
  for script in "${REQUIRED[@]}"; do
    if ! node -e "
      const pkg = require('${pkg/#./$(pwd)}');
      process.exit(pkg.scripts && pkg.scripts['$script'] ? 0 : 1);
    " 2>/dev/null; then
      echo "missing script '$script' in $pkg"
      missing=$((missing + 1))
    fi
  done
done

if [[ $missing -gt 0 ]]; then
  echo ""
  echo "FAIL: $missing missing script(s) across workspace packages."
  echo "Every package must define typecheck, lint, and test scripts."
  echo "See modules/ci/rules/ci.md."
  exit 1
fi

echo "OK: every workspace package defines typecheck, lint, test."
