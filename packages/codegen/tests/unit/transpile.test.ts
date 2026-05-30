import { describe, expect, it } from "vitest";
import { transpileSource } from "../../src/transpile.js";

describe("transpileSource", () => {
    it("strips types and emits declarations for a well-formed module", () => {
        const { js, dts } = transpileSource("sample.ts", "export const answer: number = 42;\n");
        expect(js).toContain("export const answer = 42");
        expect(js).not.toContain(": number");
        expect(dts).toContain("export declare const answer: number");
    });

    it("throws with a positioned message when declaration emit fails", () => {
        const source = "export function identity(value) {\n    return value;\n}\n";
        expect(() => transpileSource("broken.ts", source)).toThrow(/broken\.ts:\n\[\d+:\d+\]/);
    });
});
