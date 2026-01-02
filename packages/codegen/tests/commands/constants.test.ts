import { describe, expect, it } from "vitest";
import { FFI_OUTPUT_DIR, GIRS_DIR, REACT_OUTPUT_DIR, SYSTEM_GIRS_DIR } from "../../src/commands/constants.js";

describe("codegen constants", () => {
    describe("GIRS_DIR", () => {
        it("is defined as 'girs'", () => {
            expect(GIRS_DIR).toBe("girs");
        });
    });

    describe("SYSTEM_GIRS_DIR", () => {
        it("points to system GIR directory", () => {
            expect(SYSTEM_GIRS_DIR).toBe("/usr/share/gir-1.0");
        });
    });

    describe("FFI_OUTPUT_DIR", () => {
        it("points to FFI generated output directory", () => {
            expect(FFI_OUTPUT_DIR).toBe("packages/ffi/src/generated");
        });

        it("is under packages/ffi", () => {
            expect(FFI_OUTPUT_DIR).toMatch(/^packages\/ffi\//);
        });
    });

    describe("REACT_OUTPUT_DIR", () => {
        it("points to React generated output directory", () => {
            expect(REACT_OUTPUT_DIR).toBe("packages/react/src/generated");
        });

        it("is under packages/react", () => {
            expect(REACT_OUTPUT_DIR).toMatch(/^packages\/react\//);
        });
    });
});
