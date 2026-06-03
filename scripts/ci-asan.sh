#!/usr/bin/env bash
#
# ci-asan.sh — run the native Rust test suite under AddressSanitizer.
#
# The codec, managed-value, and boxed/fundamental ref-counting paths are where a
# double-unref or use-after-free in the FFI lives (see boxed_codec.rs's own note
# that "leak detectors and miri would surface the missed free"). A sanitizer
# turns such a defect into a deterministic CI failure instead of a crash a user
# only hits "after GC".
#
# The tests are ordinary executables, so the AddressSanitizer runtime is linked
# directly — no `-Z build-std` and no `LD_PRELOAD`. LeakSanitizer is left off
# (detect_leaks=0): the GTK libraries the tests dlopen are not instrumented and
# report benign one-time allocations, so this targets use-after-free and
# double-free.

set -euo pipefail

export RUSTUP_TOOLCHAIN=nightly
export RUSTFLAGS="-Zsanitizer=address"
export ASAN_OPTIONS="detect_leaks=0:abort_on_error=1:detect_stack_use_after_return=1"

cd packages/native
xvfb-run -a cargo +nightly test --target x86_64-unknown-linux-gnu -- --test-threads=1
