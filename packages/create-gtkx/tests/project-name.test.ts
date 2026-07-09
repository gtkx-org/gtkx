import { describe, expect, it } from "vitest";
import { isValidProjectName } from "../src/project-name.js";

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
