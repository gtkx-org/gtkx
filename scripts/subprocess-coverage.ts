import { resolveExecutable } from "@gtkx/utils";
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const WORKSPACE_ROOT = fileURLToPath(new URL("..", import.meta.url));
const TEMP_DIR = join(WORKSPACE_ROOT, "coverage", "subprocess");
const REPORT_DIR = join(WORKSPACE_ROOT, "coverage", "subprocess-report");
const INCLUDES = ["packages/*/src/**/*.ts", "packages/*/src/**/*.tsx"];

const EXCLUDES = [
    "**/dist/**",
    "**/out-tsc/**",
    "**/node_modules/**",
    "**/tests/**",
    "**/*.test.ts",
    "**/*.test.tsx",
    "packages/e2e/**",
    "packages/gl/src/generated/**",
];

const flags = (name: string, values: string[]): string[] => values.flatMap((value) => [name, value]);
const profileCount = (): number => (existsSync(TEMP_DIR) ? readdirSync(TEMP_DIR).length : 0);

const report = (): number => {
    const result = spawnSync(
        resolveExecutable("c8"),
        [
            "report",
            "--temp-directory",
            TEMP_DIR,
            "--report-dir",
            REPORT_DIR,
            "--reporter",
            "lcovonly",
            "--exclude-after-remap",
            ...flags("--include", INCLUDES),
            ...flags("--exclude", EXCLUDES),
        ],
        { cwd: WORKSPACE_ROOT, encoding: "utf8", stdio: "inherit" },
    );

    return result.status ?? 1;
};

const reportSubprocessCoverage = (): void => {
    const count = profileCount();

    if (count === 0) {
        console.error(`No subprocess coverage profiles in ${TEMP_DIR}, skipping the report.`);

        return;
    }

    console.error(`Reporting subprocess coverage from ${String(count)} profiles.`);
    process.exitCode = report();
};

reportSubprocessCoverage();
