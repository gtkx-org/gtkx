#!/usr/bin/env node --conditions=source

import { REPO_ROOT, runHeadless } from './_utils.js';
import { join } from 'path';

const nativeDir = join(REPO_ROOT, "packages", "native");

runHeadless("cargo", [
    "+nightly",
    "test",
    "--target",
    "x86_64-unknown-linux-gnu",
    "--",
    "--test-threads=1",
], {
    cwd: nativeDir,
    env: {
        ...process.env,
        RUSTUP_TOOLCHAIN: "nightly",
        RUSTFLAGS: "-Zsanitizer=address",
        ASAN_OPTIONS: "detect_leaks=0:abort_on_error=1:detect_stack_use_after_return=1",
    },
});
