import { warn } from "@gtkx/utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveVersions } from "../../../src/deploy/settings/version.js";

const resolve = (version: string, release?: string): ReturnType<typeof resolveVersions> =>
    resolveVersions({ version, release, epoch: undefined });

vi.mock("@gtkx/utils", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@gtkx/utils")>()),
    warn: vi.fn(),
}));

describe("resolveVersions", () => {
    beforeEach(() => {
        vi.mocked(warn).mockReset();
    });

    it("keeps a plain semver version and defaults the revision", () => {
        expect(resolve("1.2.3")).toEqual({
            upstream: "1.2.3",
            packageVersion: "1.2.3",
            debRevision: "1",
            rpmRelease: "1",
            epoch: null,
        });
    });

    it("strips a leading v", () => {
        expect(resolve("v1.2.3").packageVersion).toBe("1.2.3");
    });

    it("renders a prerelease with a tilde so it sorts below the final release", () => {
        expect(resolve("1.0.0-beta.1").packageVersion).toBe("1.0.0~beta.1");
    });

    it("produces the same string for deb and rpm when the prerelease contains a hyphen", () => {
        expect(resolve("1.0.0-pre-release.1").packageVersion).toBe("1.0.0~pre.release.1");
    });

    it("drops build metadata and says so", () => {
        expect(resolve("1.0.0+g1a2b3c").packageVersion).toBe("1.0.0");
        expect(vi.mocked(warn).mock.calls[0]?.[0]).toContain("build metadata");
    });

    it("carries a configured release through to both formats", () => {
        const versions = resolve("1.2.3", "4");
        expect(versions.debRevision).toBe("4");
        expect(versions.rpmRelease).toBe("4");
    });

    it("keeps an epoch as a number", () => {
        expect(resolveVersions({ version: "1.0.0", release: undefined, epoch: 2 }).epoch).toBe(2);
    });

    it("rejects an upstream version that does not start with a digit", () => {
        expect(() => resolve("release-one")).toThrow("Cannot package \"release\" as an upstream version");
    });

    it("rejects a revision that is not a valid package release", () => {
        expect(() => resolve("1.0.0", "-1")).toThrow("Cannot package \"-1\" as a packaging revision");
    });
});
