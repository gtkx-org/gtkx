#!/bin/bash
set -e

cd "$(dirname "$0")/../.."

echo "Validating desktop entry and metainfo..."
pnpm flatpak:lint

if [[ ! -f flatpak/flathub/generated-sources.json ]]; then
    echo "Error: flatpak/flathub/generated-sources.json is missing." >&2
    echo "Run flatpak/flathub/generate-sources.sh first." >&2
    exit 1
fi

echo "Building Flathub-style flatpak (from source, offline)..."
flatpak-builder \
    --force-clean \
    --user \
    --install-deps-from=flathub \
    --repo=flatpak-repo \
    build-dir \
    flatpak/flathub/com.gtkx.tutorial.yaml

echo ""
echo "Build complete. Install with:"
echo "  flatpak install --user flatpak-repo com.gtkx.tutorial"
