#!/usr/bin/env bash
#
# codegen-promote — copies the freshly captured manifest into the committed
# golden at `codegen-manifest.json`. Run after `pnpm codegen:capture` (or
# after `pnpm codegen:verify` has surfaced an intentional drift) when the
# new FFI surface is the one the repo should pin going forward.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRESH="${REPO_ROOT}/.codegen-golden/manifest.json"
GOLDEN="${REPO_ROOT}/codegen-manifest.json"

if [ ! -f "${FRESH}" ]; then
    echo "No fresh manifest at ${FRESH}. Run 'pnpm codegen:capture' first." >&2
    exit 1
fi

cp "${FRESH}" "${GOLDEN}"
echo "Promoted ${FRESH} to ${GOLDEN}."
