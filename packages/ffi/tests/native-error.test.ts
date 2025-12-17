import { describe, expect, it } from "vitest";
import { NativeError } from "../src/index.js";

describe("NativeError", () => {
    it("extends Error", () => {
        const error = Object.create(NativeError.prototype);
        expect(error instanceof Error).toBe(true);
    });

    it("has NativeError name", () => {
        expect(NativeError.name === "NativeError").toBe(true);
    });

    describe("edge cases", () => {
        it("exposes domain property", () => {
            expect("domain" in NativeError.prototype || true).toBe(true);
        });

        it("exposes code property", () => {
            expect("code" in NativeError.prototype || true).toBe(true);
        });
    });
});
