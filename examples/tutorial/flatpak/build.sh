#!/bin/bash
set -e

cd "$(dirname "$0")/.."

echo "Building GTKX Tutorial Flatpak..."

pnpm bundle

flatpak-builder \
    --force-clean \
    --user \
    --install-deps-from=flathub \
    --repo=flatpak-repo \
    build-dir \
    flatpak/com.gtkx.tutorial.yaml

flatpak build-bundle \
    flatpak-repo \
    dist/com.gtkx.tutorial.flatpak \
    com.gtkx.tutorial

echo "Flatpak built: dist/com.gtkx.tutorial.flatpak"
echo ""
echo "To install:"
echo "  flatpak install --user dist/com.gtkx.tutorial.flatpak"
echo ""
echo "To run:"
echo "  flatpak run com.gtkx.tutorial"
