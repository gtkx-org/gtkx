#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DIST_DIR="$PROJECT_DIR/dist"
REPO_ROOT="$(cd "$PROJECT_DIR/../.." && pwd)"

echo "=== Building GTKX Flatpak SEA ==="
echo "Project: $PROJECT_DIR"
echo "Output: $DIST_DIR"

mkdir -p "$DIST_DIR"

echo ""
echo "Step 1: Compiling TypeScript..."
pnpm build

echo ""
echo "Step 2: Bundling with esbuild..."
pnpm bundle

echo ""
echo "Step 3: Generating SEA blob..."
node --experimental-sea-config "$PROJECT_DIR/sea-config.json"

echo ""
echo "Step 4: Copying Node.js binary..."
cp "$(command -v node)" "$DIST_DIR/gtkx-flatpak-demo"

echo ""
echo "Step 5: Injecting SEA blob..."
npx postject "$DIST_DIR/gtkx-flatpak-demo" NODE_SEA_BLOB "$DIST_DIR/sea-prep.blob" \
    --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2

echo ""
echo "Step 6: Copying native module..."
NATIVE_MODULE="$REPO_ROOT/packages/native/dist/index.node"

if [ ! -f "$NATIVE_MODULE" ]; then
    echo "Native module not found at $NATIVE_MODULE"
    echo "Building native module..."
    (cd "$REPO_ROOT/packages/native" && pnpm native-build && pnpm build)
fi

cp "$NATIVE_MODULE" "$DIST_DIR/"

echo ""
echo "=== Build complete ==="
echo ""
echo "Output files:"
echo "  Executable: $DIST_DIR/gtkx-flatpak-demo"
echo "  Native:     $DIST_DIR/index.node"
echo ""
echo "To run: cd $DIST_DIR && ./gtkx-flatpak-demo"
