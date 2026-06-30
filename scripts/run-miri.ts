#!/usr/bin/env node --conditions=source

import { join } from "path";
import { REPO_ROOT, run } from "./_utils.js";

const nativeDir = join(REPO_ROOT, "packages", "native");

run("cargo", ["+nightly", "miri", "test", "--test", "marshalling"], {
    cwd: nativeDir,
    env: { ...process.env, RUSTUP_TOOLCHAIN: "nightly" },
});
