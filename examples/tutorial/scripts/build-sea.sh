#!/bin/bash
set -e

cd "$(dirname "$0")/.."

echo "Building Single Executable Application..."

if [[ ! -f dist/bundle.cjs ]]; then
    echo "Error: dist/bundle.cjs not found. Run 'pnpm bundle' first." >&2
    exit 1
fi

if [[ ! -f vendor/postject.cjs ]]; then
    echo "Error: vendor/postject.cjs not found. Run 'pnpm bundle:postject' first." >&2
    exit 1
fi

echo "Generating SEA blob..."
node --experimental-sea-config sea-config.json

echo "Copying Node binary..."
cp "$(command -v node)" dist/app

if [[ "$OSTYPE" == "darwin"* ]]; then
    codesign --remove-signature dist/app
fi

echo "Injecting SEA blob..."
npx --ignore-scripts postject dist/app NODE_SEA_BLOB dist/sea-prep.blob \
    --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2

chmod +x dist/app

echo ""
echo "SEA build complete!"
echo "  Binary: dist/app"
echo "  Native: dist/gtkx.node"
echo ""
echo "To run: ./dist/app"
