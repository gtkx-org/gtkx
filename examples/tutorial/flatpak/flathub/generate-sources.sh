#!/bin/bash
set -e

cd "$(dirname "$0")"

if ! command -v flatpak-node-generator >/dev/null 2>&1; then
    echo "Error: flatpak-node-generator not found." >&2
    echo "Install it with: pipx install flatpak-node-generator" >&2
    exit 1
fi

echo "Resolving package-lock.json from npm (requires network)..."
rm -f package-lock.json
npm install --package-lock-only --no-audit --no-fund

echo "Vendoring npm dependencies into generated-sources.json..."
flatpak-node-generator npm package-lock.json -o generated-sources.json

echo ""
echo "Done. Commit package.json, package-lock.json and generated-sources.json."
echo "Then pin the 'commit' field in com.gtkx.tutorial.yaml to the release commit."
