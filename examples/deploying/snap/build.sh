#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_DIR"

pnpm build:sea

mkdir -p dist/snap

snapcraft -v pack --output ./dist/snap/gtkx-demo_0.1_amd64.snap

snapcraft clean

echo "Snap package created at: dist/snap/gtkx-demo_0.1_amd64.snap"
