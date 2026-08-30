import { resolveExecutable } from "@gtkx/utils";
import { spawnSync } from "node:child_process";
import { RUST_NIGHTLY } from "./rust-nightly.js";

const runCargoNightly = (): void => {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.error("Usage: tsx ./scripts/cargo-nightly.ts <args...>");
        process.exitCode = 1;

        return;
    }

    const result = spawnSync(resolveExecutable("cargo"), args, {
        env: { ...process.env, RUSTUP_TOOLCHAIN: RUST_NIGHTLY },
        stdio: "inherit",
    });

    if (result.status !== 0) {
        process.exitCode = result.status ?? 1;
    }
};

runCargoNightly();
