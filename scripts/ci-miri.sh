#!/usr/bin/env bash
#
# ci-miri.sh — run Miri over the FFI-free marshalling subset.
#
# Miri has no access to FFI and cannot execute a `dlopen`'d GTK or `GLib`, so
# the suite at large is out of reach. The `miri_marshalling` target is written
# to touch only pointer and per-element index math over Rust-allocated buffers,
# which is exactly the unsafe surface Miri validates for provenance and
# out-of-bounds — the container-decode hot path behind the toggle/codec layer.

set -euo pipefail

export RUSTUP_TOOLCHAIN=nightly

cd packages/native
cargo +nightly miri test --test miri_marshalling
