import { describe, expect, it } from "vitest";
import { isKnownPackageManager, PACKAGE_MANAGER_FLAG_DESCRIPTION } from "../src/package-managers.js";

describe("isKnownPackageManager", () => {
    it("accepts every supported package manager", () => {
        expect(isKnownPackageManager("pnpm")).toBe(true);
        expect(isKnownPackageManager("npm")).toBe(true);
        expect(isKnownPackageManager("yarn")).toBe(true);
    });

    it("rejects an unsupported package manager", () => {
        expect(isKnownPackageManager("bun")).toBe(false);
    });
});

describe("PACKAGE_MANAGER_FLAG_DESCRIPTION", () => {
    it("joins PACKAGE_MANAGER_VALUES into the accepted-values description", () => {
        expect(PACKAGE_MANAGER_FLAG_DESCRIPTION).toBe("Package manager (pnpm, npm, yarn)");
    });
});
