import { resolveExecutable } from "@gtkx/utils";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const SCRIPT_PATH = fileURLToPath(new URL("../../../scripts/subprocess-coverage.ts", import.meta.url));
const roots: string[] = [];

const createCoverageRoot = (): string => {
    const root = mkdtempSync(join(tmpdir(), "gtkx-subprocess-coverage-"));
    roots.push(root);

    return root;
};

const report = (root: string): void => {
    execFileSync(resolveExecutable("tsx"), [SCRIPT_PATH, root], { stdio: "pipe" });
};

afterEach(() => {
    for (const root of roots) {
        rmSync(root, { recursive: true, force: true });
    }

    roots.length = 0;
});

describe("subprocess coverage reporting", () => {
    it("turns V8 profiles into LCOV without retaining the raw profiles", () => {
        const root = createCoverageRoot();
        const profiles = join(root, "subprocess");
        mkdirSync(profiles);

        execFileSync(process.execPath, ["-e", "process.stdout.write('covered')"], {
            env: { ...process.env, NODE_V8_COVERAGE: profiles },
            stdio: "pipe",
        });

        report(root);
        expect(existsSync(join(root, "subprocess-report", "lcov.info"))).toBe(true);
        expect(existsSync(profiles)).toBe(false);
    });

    it("handles 927 raw profiles and replaces a stale report", () => {
        const root = createCoverageRoot();
        const profiles = join(root, "subprocess");
        const reportDir = join(root, "subprocess-report");
        mkdirSync(profiles);
        mkdirSync(reportDir);
        writeFileSync(join(reportDir, "lcov.info"), "stale");

        execFileSync(process.execPath, ["-e", "process.stdout.write('covered')"], {
            env: { ...process.env, NODE_V8_COVERAGE: profiles },
            stdio: "pipe",
        });

        const [sourceProfile] = readdirSync(profiles);

        if (sourceProfile === undefined) {
            throw new Error("Node did not write a V8 coverage profile");
        }

        for (let index = 1; index < 927; index += 1) {
            copyFileSync(join(profiles, sourceProfile), join(profiles, `coverage-copy-${String(index)}.json`));
        }

        report(root);
        expect(existsSync(join(reportDir, "lcov.info"))).toBe(true);
        expect(existsSync(profiles)).toBe(false);
    });

    it("throws when the profile directory cannot be read", () => {
        const root = createCoverageRoot();
        const profiles = join(root, "subprocess");
        writeFileSync(profiles, "not a directory");

        expect(() => {
            report(root);
        }).toThrow();
    });
});
