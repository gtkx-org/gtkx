set -euo pipefail

architecture="$(node -p process.arch)"
case "$architecture" in
  x64|arm64) ;;
  *) exit 1 ;;
esac

native_dir="$(pwd)/packages/native"
platform="linux-${architecture}-gnu"
(
  cd "$native_dir/artifacts"
  for artifact in "native.${platform}.node" "index.${platform}.js" "index.${platform}.d.ts"; do
    sha256sum --check --strict "$artifact.sha256"
  done
)
cp "$native_dir/artifacts/native.${platform}.node" "$native_dir/native.${platform}.node"
cp "$native_dir/artifacts/index.${platform}.js" "$native_dir/index.js"
cp "$native_dir/artifacts/index.${platform}.d.ts" "$native_dir/index.d.ts"
