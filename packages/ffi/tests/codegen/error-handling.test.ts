import { describe, expect, it } from "vitest";
import { NativeError } from "../../src/index.js";

describe("error handling", () => {
    describe("NativeError class", () => {
        it("NativeError is exported", () => {
            expect(NativeError).toBeDefined();
            expect(typeof NativeError).toBe("function");
        });

        it("NativeError extends Error", () => {
            expect(NativeError.prototype).toBeInstanceOf(Error);
        });

        it("NativeError has expected static properties", () => {
            expect(NativeError.name).toBe("NativeError");
        });

        it("NativeError can be used as error type check", () => {
            const error = new Error("test");
            expect(error instanceof NativeError).toBe(false);
        });
    });
});
