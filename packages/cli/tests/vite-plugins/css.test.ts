import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { LoadHook, ResolveIdHook } from "./plugin-hook-types.js";
import { gtkxCss } from "../../src/vite-plugins/css.js";

type TmpDirRef = { path: string };

const setupAssetsTmpDir = (): TmpDirRef => {
    const ref: TmpDirRef = { path: "" };

    beforeEach(() => {
        ref.path = mkdtempSync(join(tmpdir(), "gtkx-assets-test-"));
    });

    afterEach(() => {
        rmSync(ref.path, { recursive: true, force: true });
    });

    return ref;
};

const callResolveId = async (
    resolve: (source: string) => Promise<{ id: string; external?: boolean } | null>,
    source: string,
): Promise<string | undefined | null> => {
    const plugin = gtkxCss();

    return (plugin.resolveId as ResolveIdHook).call({ resolve }, source);
};

describe("gtkxCss (plugin shape)", () => {
    it("returns a plugin with the expected name and pre-enforce", () => {
        const plugin = gtkxCss();
        expect(plugin.name).toBe("gtkx:css");
        expect(plugin.enforce).toBe("pre");
    });
});

describe("gtkxCss (resolveId)", () => {
    setupAssetsTmpDir();

    it("resolveId ignores non-CSS sources", async () => {
        const result = await callResolveId(() => Promise.resolve({ id: "" }), "./image.png");
        expect(result).toBeUndefined();
    });

    it("resolveId returns undefined when the resolved CSS is external", async () => {
        const result = await callResolveId(
            () => Promise.resolve({ id: "/abs/style.css", external: true }),
            "./style.css",
        );

        expect(result).toBeUndefined();
    });

    it("resolveId returns undefined when resolve yields null", async () => {
        const result = await callResolveId(() => Promise.resolve(null), "./style.css");
        expect(result).toBeUndefined();
    });

    it("resolveId returns the virtual prefix for CSS imports", async () => {
        const result = await callResolveId(() => Promise.resolve({ id: "/abs/style.css" }), "./style.css");
        expect(result).toBe("\0gtkx-css:/abs/style.css?inject");
    });
});

describe("gtkxCss (load)", () => {
    const tmpDir = setupAssetsTmpDir();

    it("load injects CSS contents via injectGlobal for virtual ids", () => {
        const plugin = gtkxCss();
        const cssPath = join(tmpDir.path, "style.css");
        writeFileSync(cssPath, "body { color: red; }");
        const out = (plugin.load as LoadHook)(`\0gtkx-css:${cssPath}?inject`);
        expect(out).toContain('import { injectGlobal } from "@gtkx/css";');
        expect(out).toContain(`injectGlobal(${JSON.stringify("body { color: red; }")});`);
    });

    it("load returns undefined for non-virtual ids (binary assets handled by gtkx:resources)", () => {
        const plugin = gtkxCss();
        expect((plugin.load as LoadHook)("/abs/path/logo.png")).toBeUndefined();
        expect((plugin.load as LoadHook)("/abs/path/module.ts")).toBeUndefined();
    });
});
