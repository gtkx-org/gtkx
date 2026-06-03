#!/usr/bin/env bash
#
# ci-asan.sh — build the native addon under AddressSanitizer and run the native
# vitest suite against it.
#
# The toggle-reference ref/unref accounting and the finalize teardown are where
# a double-unref or use-after-free would live; a sanitizer turns such a defect
# into a deterministic failure instead of a crash a user only hits "after GC".
#
# Mirrors napi-rs's asan workflow: rebuild std with the sanitizer (`-Z build-std`,
# needs the rust-src component) and preload the GCC AddressSanitizer runtime so
# its symbols resolve before Node dlopens the instrumented `.node`. LeakSanitizer
# is left off (detect_leaks=0) because Node reports benign exit-time leaks, so
# this targets use-after-free and double-free.

set -euo pipefail

export RUSTUP_TOOLCHAIN=nightly
export RUSTFLAGS="-Z sanitizer=address -C link-args=-Wl,-z,nodelete"
export ASAN_OPTIONS="detect_leaks=0"

pushd packages/native >/dev/null
pnpm exec napi build --platform --release \
  --target x86_64-unknown-linux-gnu \
  --js native-binding.cjs --dts native-binding.d.cts \
  -- -Z build-std
cp native.linux-x64-gnu.node npm/linux-x64-gnu/
popd >/dev/null

ASAN_RT="/usr/lib/gcc/x86_64-redhat-linux/$(gcc -dumpversion)/libasan.so"
if [ ! -f "$ASAN_RT" ]; then
  echo "ci-asan: GCC AddressSanitizer runtime not found at $ASAN_RT; candidates:" >&2
  find /usr/lib/gcc -name 'libasan.so*' 2>/dev/null >&2 || true
  exit 1
fi

LD_PRELOAD="$ASAN_RT" xvfb-run -a pnpm --filter @gtkx/native test
