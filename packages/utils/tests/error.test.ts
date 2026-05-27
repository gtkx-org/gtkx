import { describe, expect, it } from "vitest";
import { errorMessage } from "../src/error.js";

describe("errorMessage", () => {
    it("returns the message of an Error instance", () => {
        expect(errorMessage(new Error("boom"))).toBe("boom");
    });

    it("returns the message of a subclass of Error", () => {
        class CustomError extends Error {
            constructor() {
                super("custom");
                this.name = "CustomError";
            }
        }
        expect(errorMessage(new CustomError())).toBe("custom");
    });

    it("stringifies a non-Error throw value", () => {
        expect(errorMessage("plain string")).toBe("plain string");
        expect(errorMessage(42)).toBe("42");
        expect(errorMessage(null)).toBe("null");
        expect(errorMessage(undefined)).toBe("undefined");
    });

    it("stringifies an object that is not an Error", () => {
        expect(errorMessage({ code: "E_BAD" })).toBe("[object Object]");
    });
});
