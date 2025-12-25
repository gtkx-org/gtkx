#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_DIR"

pnpm build:sea

mkdir -p dist/flatpak

TEMP_REPO=$(mktemp -d)

flatpak-builder --user --install --force-clean --repo="$TEMP_REPO" build-dir flatpak/org.gtkx.flatpak.yaml

flatpak build-bundle "$TEMP_REPO" dist/flatpak/org.gtkx.flatpak.flatpak org.gtkx.flatpak

rm -rf "$TEMP_REPO"

echo "Flatpak bundle created at: dist/flatpak/org.gtkx.flatpak.flatpak"
