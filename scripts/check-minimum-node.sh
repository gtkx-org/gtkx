set -euo pipefail

minimum_node=26.7.0
declared_engine="$(node -p 'JSON.parse(require("node:fs").readFileSync("package.json", "utf8")).engines.node')"
if [ "$declared_engine" != ">=$minimum_node" ]; then
  echo "Update the minimum Node compatibility pin to match package.json"
  exit 1
fi

architecture="$(node -p 'process.arch')"
case "$architecture" in
  x64) checksum=982aa24dd8be4c889c6a8ab337ddff3b0896645b20f4239356e80552c16277ee ;;
  arm64) checksum=afc7a004018485092ac8985b817b0d5684472bd9472e0b57d2ab88737e50090d ;;
  *) exit 1 ;;
esac

runtime_dir="$(mktemp -d)"
trap 'rm -rf "$runtime_dir"' EXIT
archive="node-v${minimum_node}-linux-${architecture}.tar.xz"
curl --fail --silent --show-error --location --retry 3 \
  "https://nodejs.org/dist/v${minimum_node}/${archive}" -o "$runtime_dir/$archive"
printf '%s  %s\n' "$checksum" "$runtime_dir/$archive" | sha256sum --check --status
tar --extract --xz --file "$runtime_dir/$archive" --directory "$runtime_dir" --strip-components=1

export PATH="$runtime_dir/bin:$PATH"
node --version
pnpm release-e2e
