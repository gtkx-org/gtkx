import { describe, expect, it } from "vitest";
import { gtkxRefresh } from "../../../src/vite-plugins/fast-refresh/header.js";

type TransformFn = (code: string, id: string, options?: { ssr?: boolean }) => { code: string; map: null } | undefined;

const defaultTransform = gtkxRefresh().transform as TransformFn;

describe("gtkxRefresh (plugin shape)", () => {
    it("returns plugin with correct name", () => {
        const plugin = gtkxRefresh();
        expect(plugin.name).toBe("gtkx:refresh");
    });

    it("enforces post order", () => {
        const plugin = gtkxRefresh();
        expect(plugin.enforce).toBe("post");
    });
});

describe("gtkxRefresh transform (skip cases)", () => {
    it("returns undefined for non-SSR transforms", () => {
        const result = defaultTransform("const a = 1", "test.tsx", { ssr: false });
        expect(result).toBeUndefined();
    });

    it("returns undefined when ssr option is not provided", () => {
        const result = defaultTransform("const a = 1", "test.tsx");
        expect(result).toBeUndefined();
    });

    it("returns undefined for files not matching include pattern", () => {
        const result = defaultTransform("const a = 1", "test.css", { ssr: true });
        expect(result).toBeUndefined();
    });

    it("returns undefined for node_modules files", () => {
        const result = defaultTransform("const $RefreshReg$ = 1", "node_modules/react/index.tsx", { ssr: true });
        expect(result).toBeUndefined();
    });

    it("returns undefined for code without refresh markers", () => {
        const result = defaultTransform("const a = 1", "test.tsx", { ssr: true });
        expect(result).toBeUndefined();
    });
});

describe("gtkxRefresh transform (refresh markers)", () => {
    it("transforms code with $RefreshReg$", () => {
        const code = "const $RefreshReg$ = something;";
        const result = defaultTransform(code, "/src/app.tsx", { ssr: true });

        expect(result).toBeDefined();
        expect(result?.code).toContain("import { createModuleRegistration");
        expect(result?.code).toContain('__createModuleRegistration__("/src/app.tsx")');
        expect(result?.code).toContain(code);
    });

    it("transforms code with $RefreshSig$", () => {
        const code = "const $RefreshSig$ = something;";
        const result = defaultTransform(code, "/src/component.tsx", { ssr: true });

        expect(result).toBeDefined();
        expect(result?.code).toContain("import { createModuleRegistration");
    });

    it("transforms code with both refresh markers", () => {
        const code = "$RefreshReg$(); $RefreshSig$();";
        const result = defaultTransform(code, "/src/both.tsx", { ssr: true });

        expect(result).toBeDefined();
        expect(result?.code).toContain("import { createModuleRegistration");
    });

    it("escapes module id in JSON", () => {
        const code = "const $RefreshReg$ = 1;";
        const result = defaultTransform(code, '/src/path with "quotes".tsx', { ssr: true });

        expect(result).toBeDefined();
        expect(result?.code).toContain('"/src/path with \\"quotes\\".tsx"');
    });

    it("returns null map", () => {
        const code = "const $RefreshReg$ = 1;";
        const result = defaultTransform(code, "/src/app.tsx", { ssr: true });

        expect(result?.map).toBeNull();
    });
});

describe("gtkxRefresh transform (file extensions)", () => {
    it("handles .ts files", () => {
        const result = defaultTransform("$RefreshReg$();", "/src/util.ts", { ssr: true });
        expect(result).toBeDefined();
    });

    it("handles .jsx files", () => {
        const result = defaultTransform("$RefreshReg$();", "/src/App.jsx", { ssr: true });
        expect(result).toBeDefined();
    });

    it("handles .js files", () => {
        const result = defaultTransform("$RefreshReg$();", "/src/index.js", { ssr: true });
        expect(result).toBeDefined();
    });

    it("skips files outside the default include pattern", () => {
        const result = defaultTransform("$RefreshReg$();", "/src/styles.custom", { ssr: true });
        expect(result).toBeUndefined();
    });
});
