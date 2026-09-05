import { resolveExecutable } from "@gtkx/utils";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync, symlinkSync } from "node:fs";
import { availableParallelism } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const WORKSPACE_ROOT = fileURLToPath(new URL("..", import.meta.url));
const TEMP_DIR = join(WORKSPACE_ROOT, "coverage", "subprocess");
const BATCH_DIR = join(WORKSPACE_ROOT, "coverage", "subprocess-batches");
const REPORT_DIR = join(WORKSPACE_ROOT, "coverage", "subprocess-report");
const INCLUDES = ["packages/*/src/**/*.ts", "packages/*/src/**/*.tsx"];
const PROFILES_PER_BATCH = 48;
const BATCH_HEAP = "--max-old-space-size=2048";

const EXCLUDES = [
    "**/dist/**",
    "**/out-tsc/**",
    "**/node_modules/**",
    "**/tests/**",
    "**/*.d.ts",
    "**/*.test.ts",
    "**/*.test.tsx",
    "packages/e2e/**",
    "packages/gl/src/generated/**",
];

const flags = (name: string, values: string[]): string[] => values.flatMap((value) => [name, value]);
const profiles = (): string[] => (existsSync(TEMP_DIR) ? readdirSync(TEMP_DIR) : []);

const batchCount = (total: number): number =>
    Math.max(1, Math.min(availableParallelism(), Math.ceil(total / PROFILES_PER_BATCH)));

const linkBatches = (names: string[], count: number): string[] => {
    rmSync(BATCH_DIR, { recursive: true, force: true });

    for (let index = 0; index < count; index += 1) {
        mkdirSync(join(BATCH_DIR, String(index)), { recursive: true });
    }

    for (const [index, name] of names.entries()) {
        symlinkSync(join(TEMP_DIR, name), join(BATCH_DIR, String(index % count), name));
    }

    return Array.from({ length: count }, (_, index) => String(index));
};

const report = (batch: string): Promise<number> =>
    new Promise((resolve) => {
        const child = spawn(
            resolveExecutable("c8"),
            [
                "report",
                "--temp-directory",
                join(BATCH_DIR, batch),
                "--report-dir",
                join(REPORT_DIR, batch),
                "--reporter",
                "lcovonly",
                "--exclude-after-remap",
                ...flags("--include", INCLUDES),
                ...flags("--exclude", EXCLUDES),
            ],
            {
                cwd: WORKSPACE_ROOT,
                stdio: "inherit",
                env: { ...process.env, NODE_OPTIONS: BATCH_HEAP },
            },
        );

        child.on("close", (code) => {
            resolve(code ?? 1);
        });
    });

const reportSubprocessCoverage = async (): Promise<void> => {
    const names = profiles();

    if (names.length === 0) {
        console.error(`No subprocess coverage profiles in ${TEMP_DIR}, skipping the report.`);

        return;
    }

    rmSync(REPORT_DIR, { recursive: true, force: true });
    const count = batchCount(names.length);
    console.error(`Reporting subprocess coverage from ${String(names.length)} profiles in ${String(count)} batches.`);
    const codes = await Promise.all(linkBatches(names, count).map((batch) => report(batch)));
    rmSync(BATCH_DIR, { recursive: true, force: true });
    process.exitCode = codes.find((code) => code !== 0) ?? 0;
};

await reportSubprocessCoverage();
