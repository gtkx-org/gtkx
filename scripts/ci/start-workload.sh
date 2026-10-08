#!/usr/bin/env bash
set -euo pipefail

: "${GTKX_CI_CONTAINER:?Set a unique workload container name}"
workspace="$(pwd -P)"
if [[ -n "${NX_HEAD:-}" && "$(git rev-parse HEAD)" != "$NX_HEAD" ]]; then
  echo "The checked-out commit does not match the coordinator's NX_HEAD." >&2
  exit 1
fi
cache_root="$workspace/.nx/ci"
mkdir -p "$cache_root/pnpm-store" "$cache_root/cargo-registry" "$cache_root/cargo-git"

if [[ "${GTKX_CI_PREBUILT:-false}" != true ]]; then
  docker buildx build --load --file scripts/ci/Dockerfile \
    --build-arg "GTKX_UID=$(id -u)" --build-arg "GTKX_GID=$(id -g)" \
    --tag "$GTKX_CI_CONTAINER:local" "$@" .
fi

docker run --detach --name "$GTKX_CI_CONTAINER" --init --shm-size=2g \
  --mount "type=bind,source=$workspace,target=$workspace" \
  --mount "type=bind,source=$cache_root/pnpm-store,target=/home/gtkx/.pnpm-store" \
  --mount "type=bind,source=$cache_root/cargo-registry,target=/home/gtkx/.cargo/registry" \
  --mount "type=bind,source=$cache_root/cargo-git,target=/home/gtkx/.cargo/git" \
  --workdir "$workspace" \
  --env CI=true --env npm_config_store_dir=/home/gtkx/.pnpm-store \
  "$GTKX_CI_CONTAINER:local"

docker exec "$GTKX_CI_CONTAINER" pnpm install --frozen-lockfile

for mode in runtime native; do
  fingerprint="$(node scripts/ci/run.mjs "node scripts/cache-environment.ts $mode")"
  if [[ ! "$fingerprint" =~ ^[0-9a-f]{64}$ ]]; then
    echo "The workload did not produce a valid $mode environment fingerprint." >&2
    exit 1
  fi
  expected_name="GTKX_CI_${mode^^}_HASH"
  if [[ -n "${!expected_name:-}" && "${!expected_name}" != "$fingerprint" ]]; then
    echo "The agent's $mode environment differs from the coordinator. Rebuild both image caches." >&2
    exit 1
  fi
  printf '%s=%s\n' "$expected_name" "$fingerprint"
done > "$cache_root/environment"
