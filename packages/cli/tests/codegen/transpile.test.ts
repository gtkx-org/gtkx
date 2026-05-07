import { describe, expect, it } from "vitest";
import { transpileCodegenFiles } from "../../src/codegen/transpile.js";

describe("transpileCodegenFiles", () => {
    it("emits a .js and .d.ts pair for each .ts input", () => {
        const sources = new Map<string, string>([["foo.ts", "export const foo: number = 1;\n"]]);

        const result = transpileCodegenFiles(sources);

        expect(result.has("foo.js")).toBe(true);
        expect(result.has("foo.d.ts")).toBe(true);
        expect(result.has("foo.ts")).toBe(false);
    });

    it("strips type annotations in the .js output", () => {
        const sources = new Map<string, string>([["x.ts", 'export const x: string = "hello";\n']]);

        const result = transpileCodegenFiles(sources);

        const js = result.get("x.js") ?? "";
        expect(js).toContain('"hello"');
        expect(js).not.toContain(": string");
    });

    it("emits an isolated declaration in the .d.ts output", () => {
        const sources = new Map<string, string>([["pair.ts", "export const value: number = 42;\n"]]);

        const result = transpileCodegenFiles(sources);

        const dts = result.get("pair.d.ts") ?? "";
        expect(dts).toContain("export declare const value");
        expect(dts).toContain("number");
    });

    it("passes through non-.ts entries unchanged", () => {
        const sources = new Map<string, string>([
            ["readme.txt", "hello"],
            ["data.json", '{"a":1}'],
        ]);

        const result = transpileCodegenFiles(sources);

        expect(result.get("readme.txt")).toBe("hello");
        expect(result.get("data.json")).toBe('{"a":1}');
    });

    it("processes multiple .ts inputs independently", () => {
        const sources = new Map<string, string>([
            ["a.ts", "export const a: number = 1;\n"],
            ["b.ts", "export const b: number = 2;\n"],
        ]);

        const result = transpileCodegenFiles(sources);

        expect(result.has("a.js")).toBe(true);
        expect(result.has("a.d.ts")).toBe(true);
        expect(result.has("b.js")).toBe(true);
        expect(result.has("b.d.ts")).toBe(true);
    });

    it("throws when declaration emit cannot infer types (no explicit annotation)", () => {
        const sources = new Map<string, string>([["bad.ts", "export const inferred = (() => 1)();\n"]]);

        expect(() => transpileCodegenFiles(sources)).toThrow(/transpileDeclaration failed/);
    });

    it("preserves nested directories in output keys", () => {
        const sources = new Map<string, string>([["sub/dir/mod.ts", "export const m: number = 1;\n"]]);

        const result = transpileCodegenFiles(sources);

        expect(result.has("sub/dir/mod.js")).toBe(true);
        expect(result.has("sub/dir/mod.d.ts")).toBe(true);
    });
});
