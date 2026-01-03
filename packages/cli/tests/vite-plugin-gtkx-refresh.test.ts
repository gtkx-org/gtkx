import { describe, expect, it } from "vitest";
import { gtkxRefresh } from "../src/vite-plugin-gtkx-refresh.js";

describe("gtkxRefresh", () => {
    it("returns plugin with correct name", () => {
        const plugin = gtkxRefresh();
        expect(plugin.name).toBe("gtkx:refresh");
    });

    it("enforces post order", () => {
        const plugin = gtkxRefresh();
        expect(plugin.enforce).toBe("post");
    });

    describe("transform", () => {
        const transform = gtkxRefresh().transform as (
            code: string,
            id: string,
            options?: { ssr?: boolean },
        ) => { code: string; map: null } | undefined;

        it("returns undefined for non-SSR transforms", () => {
            const result = transform("const a = 1", "test.tsx", { ssr: false });
            expect(result).toBeUndefined();
        });

        it("returns undefined when ssr option is not provided", () => {
            const result = transform("const a = 1", "test.tsx");
            expect(result).toBeUndefined();
        });

        it("returns undefined for files not matching include pattern", () => {
            const result = transform("const a = 1", "test.css", { ssr: true });
            expect(result).toBeUndefined();
        });

        it("returns undefined for node_modules files", () => {
            const result = transform("const $RefreshReg$ = 1", "node_modules/react/index.tsx", { ssr: true });
            expect(result).toBeUndefined();
        });

        it("returns undefined for code without refresh markers", () => {
            const result = transform("const a = 1", "test.tsx", { ssr: true });
            expect(result).toBeUndefined();
        });

        it("transforms code with $RefreshReg$", () => {
            const code = "const $RefreshReg$ = something;";
            const result = transform(code, "/src/app.tsx", { ssr: true });

            expect(result).toBeDefined();
            expect(result?.code).toContain("import { createModuleRegistration");
            expect(result?.code).toContain('__createModuleRegistration__("/src/app.tsx")');
            expect(result?.code).toContain(code);
        });

        it("transforms code with $RefreshSig$", () => {
            const code = "const $RefreshSig$ = something;";
            const result = transform(code, "/src/component.tsx", { ssr: true });

            expect(result).toBeDefined();
            expect(result?.code).toContain("import { createModuleRegistration");
        });

        it("transforms code with both refresh markers", () => {
            const code = "$RefreshReg$(); $RefreshSig$();";
            const result = transform(code, "/src/both.tsx", { ssr: true });

            expect(result).toBeDefined();
            expect(result?.code).toContain("import { createModuleRegistration");
        });

        it("escapes module id in JSON", () => {
            const code = "const $RefreshReg$ = 1;";
            const result = transform(code, '/src/path with "quotes".tsx', { ssr: true });

            expect(result).toBeDefined();
            expect(result?.code).toContain('"/src/path with \\"quotes\\".tsx"');
        });

        it("returns null map", () => {
            const code = "const $RefreshReg$ = 1;";
            const result = transform(code, "/src/app.tsx", { ssr: true });

            expect(result?.map).toBeNull();
        });

        it("handles .ts files", () => {
            const code = "$RefreshReg$();";
            const result = transform(code, "/src/util.ts", { ssr: true });

            expect(result).toBeDefined();
        });

        it("handles .jsx files", () => {
            const code = "$RefreshReg$();";
            const result = transform(code, "/src/App.jsx", { ssr: true });

            expect(result).toBeDefined();
        });

        it("handles .js files", () => {
            const code = "$RefreshReg$();";
            const result = transform(code, "/src/index.js", { ssr: true });

            expect(result).toBeDefined();
        });
    });

    describe("custom options", () => {
        it("respects custom include pattern", () => {
            const plugin = gtkxRefresh({ include: /\.custom$/ });
            const transform = plugin.transform as (
                code: string,
                id: string,
                options?: { ssr?: boolean },
            ) => { code: string; map: null } | undefined;

            const result1 = transform("$RefreshReg$()", "test.custom", { ssr: true });
            expect(result1).toBeDefined();

            const result2 = transform("$RefreshReg$()", "test.tsx", { ssr: true });
            expect(result2).toBeUndefined();
        });

        it("respects custom exclude pattern", () => {
            const plugin = gtkxRefresh({ exclude: /vendor/ });
            const transform = plugin.transform as (
                code: string,
                id: string,
                options?: { ssr?: boolean },
            ) => { code: string; map: null } | undefined;

            const result1 = transform("$RefreshReg$()", "vendor/lib.tsx", { ssr: true });
            expect(result1).toBeUndefined();

            const result2 = transform("$RefreshReg$()", "node_modules/lib.tsx", { ssr: true });
            expect(result2).toBeDefined();
        });
    });
});
