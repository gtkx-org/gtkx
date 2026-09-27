import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const [target, ...options] = process.argv.slice(2);

if (!target || !new Set(["lint", "typecheck", "test"]).has(target)) {
    throw new Error("Expected lint, typecheck, or test");
}

const isFullRun = process.env.GTKX_CI_FULL === "true";

if (!isFullRun && (!process.env.NX_BASE || !process.env.NX_HEAD)) {
    throw new Error("Affected execution requires both Git revisions");
}

const targets = target === "lint" ? "lint,lint:rust" : target;
const result = spawnSync(process.execPath, [
    fileURLToPath(import.meta.resolve("nx")),
    isFullRun ? "run-many" : "affected",
    `--targets=${targets}`,
    ...options,
], { stdio: "inherit" });

if (result.error) {
    throw result.error;
}

process.exitCode = result.status ?? 1;
