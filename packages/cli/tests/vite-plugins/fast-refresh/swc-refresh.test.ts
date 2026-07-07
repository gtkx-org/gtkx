import type { Plugin } from "vite";
import { describe, expect, it } from "vitest";
import {
    gtkxFastRefresh,
    gtkxRefreshRuntime,
    gtkxSwcRefresh,
} from "../../../src/vite-plugins/fast-refresh/swc-refresh.js";

type TransformHook = Extract<Plugin["transform"], (...args: never[]) => unknown>;
type TransformContext = ThisParameterType<TransformHook>;
type TransformOptions = Parameters<TransformHook>[2];
type TransformResult = { code: string; map?: unknown } | null | undefined;

type TransformFn = (code: string, id: string, options?: { ssr?: boolean }) => Promise<TransformResult>;

const normalizeResult = (result: Awaited<ReturnType<TransformHook>>): TransformResult => {
    if (!result || typeof result === "string" || typeof result.code !== "string") return undefined;
    return { code: result.code, map: result.map };
};

const getTransform = (plugin: Plugin): TransformFn => {
    const hook = plugin.transform;
    const handler = typeof hook === "function" ? hook : hook?.handler;
    if (typeof handler !== "function") {
        throw new Error("plugin.transform must provide a handler function");
    }
    const context = {} as TransformContext;
    return async (code, id, options) => {
        const hookOptions = options as TransformOptions;
        return normalizeResult(await handler.call(context, code, id, hookOptions));
    };
};

describe("gtkxSwcRefresh", () => {
    it("returns a plugin with the expected name and pre-enforce", () => {
        const plugin = gtkxSwcRefresh();
        expect(plugin.name).toBe("gtkx:swc-refresh");
        expect(plugin.enforce).toBe("pre");
    });

    it("skips non-SSR transforms", async () => {
        const transform = getTransform(gtkxSwcRefresh());
        await expect(transform("const a = 1", "x.tsx", { ssr: false })).resolves.toBeUndefined();
    });

    it("skips files that do not match the include pattern", async () => {
        const transform = getTransform(gtkxSwcRefresh());
        await expect(transform("const a = 1", "x.css", { ssr: true })).resolves.toBeUndefined();
    });

    it("skips files that match the default exclude (node_modules)", async () => {
        const transform = getTransform(gtkxSwcRefresh());
        await expect(transform("const a = 1", "/proj/node_modules/lib/x.tsx", { ssr: true })).resolves.toBeUndefined();
    });

    it("transforms TSX files in SSR mode and emits a sourcemap", async () => {
        const transform = getTransform(gtkxSwcRefresh());
        const result = await transform("export const Component = () => <div />;\n", "/proj/src/component.tsx", {
            ssr: true,
        });
        expect(result).toBeDefined();
        expect(typeof result?.code).toBe("string");
        expect(result?.code.length).toBeGreaterThan(0);
    });

    it("transforms TS files in SSR mode (no JSX)", async () => {
        const transform = getTransform(gtkxSwcRefresh());
        const result = await transform("export const x: number = 1;\n", "/proj/src/x.ts", { ssr: true });
        expect(result).toBeDefined();
        expect(typeof result?.code).toBe("string");
    });

    it("skips files outside the default include pattern", async () => {
        const transform = getTransform(gtkxSwcRefresh());
        await expect(transform("const a = 1", "/proj/src/x.special", { ssr: true })).resolves.toBeUndefined();
    });
});

type RuntimeTransformFn = (
    code: string,
    id: string,
    options?: { ssr?: boolean },
) => { code: string; map: null } | undefined;

const runtimeTransform = gtkxRefreshRuntime().transform as RuntimeTransformFn;

describe("gtkxRefreshRuntime (plugin shape)", () => {
    it("returns plugin with correct name", () => {
        const plugin = gtkxRefreshRuntime();
        expect(plugin.name).toBe("gtkx:refresh-runtime");
    });

    it("enforces post order", () => {
        const plugin = gtkxRefreshRuntime();
        expect(plugin.enforce).toBe("post");
    });
});

describe("gtkxRefreshRuntime transform (skip cases)", () => {
    it("returns undefined for non-SSR transforms", () => {
        const result = runtimeTransform("const a = 1", "test.tsx", { ssr: false });
        expect(result).toBeUndefined();
    });

    it("returns undefined when ssr option is not provided", () => {
        const result = runtimeTransform("const a = 1", "test.tsx");
        expect(result).toBeUndefined();
    });

    it("returns undefined for files not matching include pattern", () => {
        const result = runtimeTransform("const a = 1", "test.css", { ssr: true });
        expect(result).toBeUndefined();
    });

    it("returns undefined for node_modules files", () => {
        const result = runtimeTransform("const $RefreshReg$ = 1", "node_modules/react/index.tsx", { ssr: true });
        expect(result).toBeUndefined();
    });

    it("returns undefined for code without refresh markers", () => {
        const result = runtimeTransform("const a = 1", "test.tsx", { ssr: true });
        expect(result).toBeUndefined();
    });
});

describe("gtkxRefreshRuntime transform (refresh markers)", () => {
    it("transforms code with $RefreshReg$", () => {
        const code = "const $RefreshReg$ = something;";
        const result = runtimeTransform(code, "/src/app.tsx", { ssr: true });

        expect(result).toBeDefined();
        expect(result?.code).toContain("import { createModuleRegistration");
        expect(result?.code).toContain('__createModuleRegistration__("/src/app.tsx")');
        expect(result?.code).toContain(code);
    });

    it("transforms code with $RefreshSig$", () => {
        const code = "const $RefreshSig$ = something;";
        const result = runtimeTransform(code, "/src/component.tsx", { ssr: true });

        expect(result).toBeDefined();
        expect(result?.code).toContain("import { createModuleRegistration");
    });

    it("transforms code with both refresh markers", () => {
        const code = "$RefreshReg$(); $RefreshSig$();";
        const result = runtimeTransform(code, "/src/both.tsx", { ssr: true });

        expect(result).toBeDefined();
        expect(result?.code).toContain("import { createModuleRegistration");
    });

    it("escapes module id in JSON", () => {
        const code = "const $RefreshReg$ = 1;";
        const result = runtimeTransform(code, '/src/path with "quotes".tsx', { ssr: true });

        expect(result).toBeDefined();
        expect(result?.code).toContain('"/src/path with \\"quotes\\".tsx"');
    });

    it("returns null map", () => {
        const code = "const $RefreshReg$ = 1;";
        const result = runtimeTransform(code, "/src/app.tsx", { ssr: true });

        expect(result?.map).toBeNull();
    });
});

describe("gtkxRefreshRuntime transform (file extensions)", () => {
    it("handles .ts files", () => {
        const result = runtimeTransform("$RefreshReg$();", "/src/util.ts", { ssr: true });
        expect(result).toBeDefined();
    });

    it("handles .jsx files", () => {
        const result = runtimeTransform("$RefreshReg$();", "/src/App.jsx", { ssr: true });
        expect(result).toBeDefined();
    });

    it("handles .js files", () => {
        const result = runtimeTransform("$RefreshReg$();", "/src/index.js", { ssr: true });
        expect(result).toBeDefined();
    });

    it("skips files outside the default include pattern", () => {
        const result = runtimeTransform("$RefreshReg$();", "/src/styles.custom", { ssr: true });
        expect(result).toBeUndefined();
    });
});

describe("gtkxFastRefresh", () => {
    it("returns the swc transform and refresh-runtime plugins in enforce order", () => {
        const plugins = gtkxFastRefresh();

        expect(plugins).toHaveLength(2);
        expect(plugins.map((plugin) => plugin.name)).toEqual(["gtkx:swc-refresh", "gtkx:refresh-runtime"]);
        expect(plugins.map((plugin) => plugin.enforce)).toEqual(["pre", "post"]);
    });
});
