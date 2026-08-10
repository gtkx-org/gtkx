import { describe, expect, it } from "vitest";
import { getInstallHint } from "../src/install-hints.js";

const CUTOFF = ", within the minimumReleaseAge cutoff (2026-08-09T08:49:41.166Z)";

const LOCKFILE_VIOLATION = [
    "`corepack pnpm add -D @gtkx/testing@^1.0.0` failed.",
    "? Verifying lockfile against supply-chain policies (300 entries)...",
    "✗ Lockfile failed supply-chain policy check (300 entries in 1.2s)",
    "[ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION] 3 lockfile entries failed verification:",
    `  @gtkx/cli@1.0.0 was published at 2026-08-09T23:05:32.217Z${CUTOFF}`,
    `  @gtkx/config@1.0.0 was published at 2026-08-09T23:05:27.984Z${CUTOFF}`,
    `  create-gtkx@1.0.0 was published at 2026-08-09T23:05:24.090Z${CUTOFF}`,
    "",
    "The lockfile contains entries that the active policies reject.",
].join("\n");

const NO_MATURE_VERSION = [
    "`corepack pnpm add -D @gtkx/testing@^1.0.0` failed.",
    "Progress: resolved 1, reused 0, downloaded 0, added 0",
    "[ERR_PNPM_NO_MATURE_MATCHING_VERSION] 4 versions do not meet the minimumReleaseAge constraint:",
    `  @gtkx/runtime@1.0.0 was published at 2026-08-09T23:05:26.446Z${CUTOFF}`,
    `  @gtkx/runtime@1.0.0 was published at 2026-08-09T23:05:26.446Z${CUTOFF}`,
    `  @gtkx/utils@1.0.0 was published at 2026-08-09T23:05:31.448Z${CUTOFF}`,
    `  @gtkx/utils@1.0.0 was published at 2026-08-09T23:05:31.448Z${CUTOFF}`,
].join("\n");

const WITHOUT_VERSION_LINES = "[ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION] 3 lockfile entries failed verification:";
const UNRELATED_FAILURE = "`corepack pnpm add -D vite` failed.\nENOENT: no such file or directory";

describe("getInstallHint (release age)", () => {
    it("names the policy behind a lockfile verification failure", () => {
        const hint = getInstallHint(LOCKFILE_VIOLATION);
        expect(hint).toContain("minimumReleaseAge policy");
        expect(hint).toContain("published in the last 24 hours");
    });

    it("lists every version pnpm rejected as a pnpm-workspace.yaml exclusion", () => {
        expect(getInstallHint(LOCKFILE_VIOLATION)).toContain(
            [
                "minimumReleaseAgeExclude:",
                "  - '@gtkx/cli@1.0.0'",
                "  - '@gtkx/config@1.0.0'",
                "  - 'create-gtkx@1.0.0'",
            ].join("\n"),
        );
    });

    it("emits the exclusion at the top level so it does not nest under allowBuilds", () => {
        const hint = getInstallHint(LOCKFILE_VIOLATION) ?? "";
        expect(hint).toMatch(/\n\nminimumReleaseAgeExclude:\n/);
        expect(hint).toContain("as a sibling of packages: and allowBuilds:");
        expect(hint).not.toContain("  minimumReleaseAgeExclude:");
    });

    it("says pnpm reports one command's versions at a time so a later install can name more", () => {
        expect(getInstallHint(LOCKFILE_VIOLATION)).toContain("a later install can name more");
    });

    it("keeps the order pnpm reported and de-duplicates repeated versions", () => {
        expect(getInstallHint(NO_MATURE_VERSION)).toContain(
            ["minimumReleaseAgeExclude:", "  - '@gtkx/runtime@1.0.0'", "  - '@gtkx/utils@1.0.0'"].join("\n"),
        );
    });

    it("points at minimumReleaseAge: 0 as the wider opt-out and prefers the list", () => {
        const hint = getInstallHint(LOCKFILE_VIOLATION);
        expect(hint).toContain('"minimumReleaseAge: 0"');
        expect(hint).toContain("prefer the list above");
    });

    it("falls back to naming the setting when no version lines are present", () => {
        const hint = getInstallHint(WITHOUT_VERSION_LINES);
        expect(hint).toContain("top-level minimumReleaseAgeExclude key in pnpm-workspace.yaml");
        expect(hint).not.toContain("  - '");
    });

    it("returns undefined for an unrelated install failure", () => {
        expect(getInstallHint(UNRELATED_FAILURE)).toBeUndefined();
    });
});
