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

# The linker script under gcc points at the real runtime SONAME, which the
# `libasan` package installs under /usr/lib64. LD_PRELOAD needs the real .so,
# not the linker script.
ASAN_RT="$(find /usr/lib64 /usr/lib -name 'libasan.so.[0-9]*' 2>/dev/null | sort | head -1)"
if [ -z "$ASAN_RT" ]; then
  echo "ci-asan: AddressSanitizer runtime not found; install the libasan package." >&2
  exit 1
fi

LD_PRELOAD="$ASAN_RT" xvfb-run -a pnpm --filter @gtkx/native test
