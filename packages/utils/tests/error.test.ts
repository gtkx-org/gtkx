import { describe, expect, it } from "vitest";
import { errorMessage, formatChildProcessError } from "../src/error.js";

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

describe("formatChildProcessError", () => {
    it("combines string stderr and stdout, trimmed", () => {
        expect(formatChildProcessError({ stderr: "err line", stdout: "out line" })).toBe("err line\nout line");
    });

    it("trims surrounding whitespace from the combined output", () => {
        expect(formatChildProcessError({ stderr: "  boom  \n" })).toBe("boom");
    });

    it("reads Buffer streams", () => {
        expect(formatChildProcessError({ stderr: Buffer.from("boom") })).toBe("boom");
    });

    it("returns undefined when neither stream carries output", () => {
        expect(formatChildProcessError({ stderr: "", stdout: "" })).toBeUndefined();
        expect(formatChildProcessError({})).toBeUndefined();
    });

    it("returns undefined for non-object throw values", () => {
        expect(formatChildProcessError(null)).toBeUndefined();
        expect(formatChildProcessError("plain")).toBeUndefined();
    });
});
