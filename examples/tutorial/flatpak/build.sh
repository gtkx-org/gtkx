#!/bin/bash
set -e

cd "$(dirname "$0")/.."

echo "Validating desktop entry and metainfo..."
npm run flatpak:lint

if [[ ! -f flatpak/generated-sources.json ]]; then
    echo "Error: flatpak/generated-sources.json is missing." >&2
    echo "Run 'npm run flatpak:sources' first." >&2
    exit 1
fi

echo "Building flatpak from source in a sandbox..."
flatpak-builder \
    --force-clean \
    --user \
    --install-deps-from=flathub \
    --repo=flatpak-repo \
    build-dir \
    flatpak/com.gtkx.tutorial.yaml

echo ""
echo "Build complete. Install with:"
echo "  flatpak install --user flatpak-repo com.gtkx.tutorial"
echo "  flatpak run com.gtkx.tutorial"
