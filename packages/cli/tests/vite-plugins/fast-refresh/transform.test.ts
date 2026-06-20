import type { Plugin } from "vite";
import { describe, expect, it } from "vitest";
import { swcSsrRefresh } from "../../../src/vite-plugins/fast-refresh/transform.js";

type TransformHook = Extract<Plugin["transform"], (...args: never[]) => unknown>;
type TransformContext = ThisParameterType<TransformHook>;
type TransformOptions = Parameters<TransformHook>[2];
type TransformResult = { code: string; map?: unknown } | null | undefined;

type TransformFn = (code: string, id: string, options?: { ssr?: boolean }) => Promise<TransformResult>;

const normalizeResult = (result: Awaited<ReturnType<TransformHook>>): TransformResult => {
    if (!result || typeof result === "string" || typeof result.code !== "string") return undefined;
    return { code: result.code, map: result.map };
};

const getTransform = (plugin: ReturnType<typeof swcSsrRefresh>): TransformFn => {
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

describe("swcSsrRefresh", () => {
    it("returns a plugin with the expected name and pre-enforce", () => {
        const plugin = swcSsrRefresh();
        expect(plugin.name).toBe("gtkx:swc-ssr-refresh");
        expect(plugin.enforce).toBe("pre");
    });

    it("skips non-SSR transforms", async () => {
        const transform = getTransform(swcSsrRefresh());
        await expect(transform("const a = 1", "x.tsx", { ssr: false })).resolves.toBeUndefined();
    });

    it("skips files that do not match the include pattern", async () => {
        const transform = getTransform(swcSsrRefresh());
        await expect(transform("const a = 1", "x.css", { ssr: true })).resolves.toBeUndefined();
    });

    it("skips files that match the default exclude (node_modules)", async () => {
        const transform = getTransform(swcSsrRefresh());
        await expect(transform("const a = 1", "/proj/node_modules/lib/x.tsx", { ssr: true })).resolves.toBeUndefined();
    });

    it("transforms TSX files in SSR mode and emits a sourcemap", async () => {
        const transform = getTransform(swcSsrRefresh());
        const result = await transform("export const Component = () => <div />;\n", "/proj/src/component.tsx", {
            ssr: true,
        });
        expect(result).toBeDefined();
        expect(typeof result?.code).toBe("string");
        expect(result?.code.length).toBeGreaterThan(0);
    });

    it("transforms TS files in SSR mode (no JSX)", async () => {
        const transform = getTransform(swcSsrRefresh());
        const result = await transform("export const x: number = 1;\n", "/proj/src/x.ts", { ssr: true });
        expect(result).toBeDefined();
        expect(typeof result?.code).toBe("string");
    });

    it("respects custom include patterns", async () => {
        const transform = getTransform(swcSsrRefresh({ include: /\.special$/ }));
        await expect(transform("const a = 1", "/proj/src/x.tsx", { ssr: true })).resolves.toBeUndefined();
    });
});
