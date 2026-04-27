#!/usr/bin/env bash
#
# End-to-end scaffold integration test.
#
# Builds milky-kit, then for each fixture under scripts/scaffold-fixtures/<name>/
# runs `milky-kit scaffold` in a fresh temp dir and validates the output by
# running `pnpm install`, per-app `pnpm typecheck`, `pnpm lint`, and (if the
# scaffolded project includes a Cargo.toml) `cargo check`.
#
# Usage:
#   bash scripts/test-scaffold.sh                  # run all fixtures
#   bash scripts/test-scaffold.sh ts-fullstack     # run a single fixture
#   KEEP_SCAFFOLD=1 bash scripts/test-scaffold.sh  # keep temp dirs for debugging
#
# Exits non-zero if any fixture fails any check.

set -euo pipefail

# Resolve paths relative to this script so we can run from any CWD.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
FIXTURES_DIR="${SCRIPT_DIR}/scaffold-fixtures"
BIN="${REPO_ROOT}/target/release/milky-kit"

# ANSI colors (only when stdout is a TTY)
if [[ -t 1 ]]; then
  C_RED=$'\033[31m'
  C_GREEN=$'\033[32m'
  C_YELLOW=$'\033[33m'
  C_BOLD=$'\033[1m'
  C_RESET=$'\033[0m'
else
  C_RED=""
  C_GREEN=""
  C_YELLOW=""
  C_BOLD=""
  C_RESET=""
fi

log() { printf '%s\n' "$*"; }
section() { printf '\n%s==> %s%s\n' "${C_BOLD}" "$*" "${C_RESET}"; }
ok() { printf '%s%s%s\n' "${C_GREEN}" "$*" "${C_RESET}"; }
warn() { printf '%s%s%s\n' "${C_YELLOW}" "$*" "${C_RESET}"; }
fail() { printf '%s%s%s\n' "${C_RED}" "$*" "${C_RESET}"; }

# Track results.
declare -a RESULTS=()

# Build milky-kit once up front.
section "Building milky-kit (release)"
(cd "${REPO_ROOT}" && cargo build --release)
if [[ ! -x "${BIN}" ]]; then
  fail "milky-kit binary not found at ${BIN}"
  exit 1
fi
ok "Built ${BIN}"

# Pick fixtures: all by default, or only the ones named on the command line.
if [[ $# -gt 0 ]]; then
  FIXTURES=("$@")
else
  FIXTURES=()
  for dir in "${FIXTURES_DIR}"/*/; do
    [[ -d "${dir}" ]] || continue
    FIXTURES+=("$(basename "${dir}")")
  done
fi

if [[ ${#FIXTURES[@]} -eq 0 ]]; then
  fail "No fixtures found under ${FIXTURES_DIR}"
  exit 1
fi

# Run a single fixture. Sets FIXTURE_REASON on failure for the summary.
FIXTURE_REASON=""
run_fixture() {
  local name="$1"
  local fixture_toml="${FIXTURES_DIR}/${name}/milky-kit.toml"
  FIXTURE_REASON=""

  if [[ ! -f "${fixture_toml}" ]]; then
    FIXTURE_REASON="missing fixture milky-kit.toml"
    return 1
  fi

  local tmp
  tmp="$(mktemp -d -t milky-kit-scaffold-"${name}".XXXXXX)"

  # Cleanup unless KEEP_SCAFFOLD=1.
  if [[ "${KEEP_SCAFFOLD:-0}" != "1" ]]; then
    # shellcheck disable=SC2064
    trap "rm -rf '${tmp}'" RETURN
  else
    log "  KEEP_SCAFFOLD=1 — leaving ${tmp} in place"
  fi

  cp "${fixture_toml}" "${tmp}/milky-kit.toml"

  section "[${name}] scaffold in ${tmp}"
  if ! (cd "${tmp}" && MILKY_KIT_HOME="${REPO_ROOT}" "${BIN}" scaffold); then
    FIXTURE_REASON="milky-kit scaffold failed"
    return 1
  fi

  # pnpm install at the workspace root (if pnpm-workspace.yaml is present).
  if [[ -f "${tmp}/pnpm-workspace.yaml" ]]; then
    section "[${name}] pnpm install"
    if ! (cd "${tmp}" && pnpm install --frozen-lockfile=false); then
      FIXTURE_REASON="pnpm install failed"
      return 1
    fi
  else
    log "  no pnpm-workspace.yaml — skipping pnpm install"
  fi

  # Per-app checks: routes:generate (TanStack Router), typecheck, lint.
  if [[ -d "${tmp}/apps" ]]; then
    for app_dir in "${tmp}"/apps/*/; do
      [[ -d "${app_dir}" ]] || continue
      local app_name
      app_name="$(basename "${app_dir}")"

      if [[ ! -f "${app_dir}/package.json" ]]; then
        log "  [${app_name}] no package.json — skipping"
        continue
      fi

      # routes:generate must run before typecheck (TanStack Router emits
      # routeTree.gen.ts that main.tsx imports). Only run if the script exists.
      if grep -q '"routes:generate"' "${app_dir}/package.json"; then
        section "[${name}/${app_name}] pnpm routes:generate"
        if ! (cd "${app_dir}" && pnpm routes:generate); then
          FIXTURE_REASON="routes:generate failed in ${app_name}"
          return 1
        fi
      fi

      if grep -q '"typecheck"' "${app_dir}/package.json"; then
        section "[${name}/${app_name}] pnpm typecheck"
        if ! (cd "${app_dir}" && pnpm typecheck); then
          FIXTURE_REASON="typecheck failed in ${app_name}"
          return 1
        fi
      fi

      if grep -q '"lint"' "${app_dir}/package.json"; then
        section "[${name}/${app_name}] pnpm lint"
        if ! (cd "${app_dir}" && pnpm lint); then
          FIXTURE_REASON="lint failed in ${app_name}"
          return 1
        fi
      fi
    done
  fi

  # Cargo check (Rust projects).
  if [[ -f "${tmp}/Cargo.toml" ]]; then
    section "[${name}] cargo check"
    if ! (cd "${tmp}" && cargo check); then
      FIXTURE_REASON="cargo check failed"
      return 1
    fi
  fi

  return 0
}

OVERALL=0
for name in "${FIXTURES[@]}"; do
  if run_fixture "${name}"; then
    RESULTS+=("PASS  ${name}")
    ok "[${name}] PASS"
  else
    RESULTS+=("FAIL  ${name} — ${FIXTURE_REASON}")
    fail "[${name}] FAIL — ${FIXTURE_REASON}"
    OVERALL=1
  fi
done

section "Summary"
for line in "${RESULTS[@]}"; do
  if [[ "${line}" == PASS* ]]; then
    ok "  ${line}"
  else
    fail "  ${line}"
  fi
done

if [[ ${OVERALL} -ne 0 ]]; then
  echo
  fail "One or more scaffold fixtures failed."
  exit 1
fi

echo
ok "All scaffold fixtures passed."
