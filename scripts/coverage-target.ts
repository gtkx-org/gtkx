import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { RUST_NIGHTLY } from "./rust-nightly.js";

const TARGET_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "packages", "native", "target");
const COVERAGE_DIR = join(TARGET_DIR, "llvm-cov-target");
const MARKER_FILE = join(TARGET_DIR, "llvm-cov-toolchain");

const readMarker = (): string | null => (existsSync(MARKER_FILE) ? readFileSync(MARKER_FILE, "utf8").trim() : null);

const dropStaleInstrumentation = (): void => {
    if (readMarker() === RUST_NIGHTLY) {
        return;
    }

    rmSync(COVERAGE_DIR, { recursive: true, force: true });
    mkdirSync(TARGET_DIR, { recursive: true });
    writeFileSync(MARKER_FILE, `${RUST_NIGHTLY}\n`);
};

dropStaleInstrumentation();
