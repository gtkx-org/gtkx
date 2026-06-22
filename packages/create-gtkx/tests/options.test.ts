import { describe, expect, it } from "vitest";
import {
    isKnownPackageManager,
    isTestingOption,
    isValidProjectName,
    PACKAGE_MANAGER_FLAG_DESCRIPTION,
    TESTING_FLAG_DESCRIPTION,
} from "../src/options.js";

describe("isValidProjectName", () => {
    it("accepts lowercase letters, digits, and hyphens", () => {
        expect(isValidProjectName("my-cool-app-123")).toBe(true);
    });

    it("rejects uppercase letters", () => {
        expect(isValidProjectName("MyApp")).toBe(false);
    });

    it("rejects underscores", () => {
        expect(isValidProjectName("my_app")).toBe(false);
    });

    it("rejects dots", () => {
        expect(isValidProjectName("my.app")).toBe(false);
    });

    it("rejects empty strings", () => {
        expect(isValidProjectName("")).toBe(false);
    });
});

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

describe("isTestingOption", () => {
    it("accepts the supported testing options", () => {
        expect(isTestingOption("vitest")).toBe(true);
        expect(isTestingOption("none")).toBe(true);
    });

    it("rejects an unsupported testing option", () => {
        expect(isTestingOption("jest")).toBe(false);
    });
});

describe("flag descriptions", () => {
    it("derive the accepted values from the supported sets", () => {
        expect(PACKAGE_MANAGER_FLAG_DESCRIPTION).toBe("Package manager (pnpm, npm, yarn)");
        expect(TESTING_FLAG_DESCRIPTION).toBe("Testing setup (vitest, none)");
    });
});
