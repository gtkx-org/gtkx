import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const WORKSPACE_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const SCRIPT_PATH = fileURLToPath(new URL("../../../scripts/verify-release-version.mjs", import.meta.url));
const RELEASE_VERSION = "1.4.0";

const verifyReleaseVersion = (version: string, environment: NodeJS.ProcessEnv = {}): string =>
    execFileSync(process.execPath, [SCRIPT_PATH, version], {
        cwd: WORKSPACE_ROOT,
        encoding: "utf8",
        env: { ...process.env, ...environment },
        stdio: "pipe",
    });

describe("release version verification", () => {
    it("accepts the version shared by every public package", () => {
        expect(verifyReleaseVersion(RELEASE_VERSION)).toContain("verified 17 packages");
    });

    it("accepts the GitHub release tag form and main-branch manual dispatch", () => {
        expect(verifyReleaseVersion(`v${RELEASE_VERSION}`, {
            GITHUB_EVENT_NAME: "release",
            GITHUB_REF: `refs/tags/v${RELEASE_VERSION}`,
        })).toContain(`at ${RELEASE_VERSION}`);

        expect(verifyReleaseVersion(RELEASE_VERSION, {
            GITHUB_EVENT_NAME: "workflow_dispatch",
            GITHUB_REF: "refs/heads/main",
        })).toContain(`at ${RELEASE_VERSION}`);
    });

    it("throws when the requested version differs or is not a complete semantic version", () => {
        for (const version of ["1.4.1", "1.4", "1.4.0-01", "1.4.0+"]) {
            expect(() => {
                verifyReleaseVersion(version);
            }).toThrow();
        }

        expect(() => {
            verifyReleaseVersion(RELEASE_VERSION, {
                GITHUB_EVENT_NAME: "workflow_dispatch",
                GITHUB_REF: "refs/heads/release-candidate",
            });
        }).toThrow();

        expect(() => {
            verifyReleaseVersion(`v${RELEASE_VERSION}`, {
                GITHUB_EVENT_NAME: "release",
                GITHUB_REF: "refs/tags/v1.4.1",
            });
        }).toThrow();
    });
});
