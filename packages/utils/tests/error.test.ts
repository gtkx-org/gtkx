import { describe, expect, it } from "vitest";
import { errorMessage, formatChildProcessError, normalizeError } from "../src/error/index.js";

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

    it("returns the message of an error-like object", () => {
        expect(errorMessage({ message: "boom" })).toBe("boom");
    });

    it("stringifies an object that is not error-like", () => {
        expect(errorMessage({ code: "E_BAD" })).toBe("[object Object]");
    });
});

describe("normalizeError", () => {
    it("returns an Error instance unchanged", () => {
        const error = new Error("boom");
        expect(normalizeError(error)).toBe(error);
    });

    it("returns a subclass of Error unchanged", () => {
        class CustomError extends Error {}
        const error = new CustomError("custom");
        expect(normalizeError(error)).toBe(error);
    });

    it("wraps an error-like object and preserves its own properties", () => {
        const result = normalizeError({ message: "boom", code: "E_BAD", errno: -2 });
        expect(result).toBeInstanceOf(Error);
        expect(result.message).toBe("boom");
        expect(Object.assign({}, result)).toMatchObject({ code: "E_BAD", errno: -2 });
    });

    it("wraps a primitive throw value in an Error carrying its message", () => {
        expect(normalizeError("plain string")).toBeInstanceOf(Error);
        expect(normalizeError("plain string").message).toBe("plain string");
        expect(normalizeError(42).message).toBe("42");
        expect(normalizeError(null).message).toBe("null");
        expect(normalizeError(undefined).message).toBe("undefined");
    });

    it("does not copy properties from a non-error-like object", () => {
        const result = normalizeError({ code: "E_BAD" });
        expect(result.message).toBe("[object Object]");
        expect(Object.assign({}, result)).not.toMatchObject({ code: "E_BAD" });
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
