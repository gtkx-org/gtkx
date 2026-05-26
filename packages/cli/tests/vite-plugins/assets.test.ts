import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { gtkxAssets } from "../../src/vite-plugins/assets.js";
import type { LoadHook, ResolveIdHook } from "./plugin-hook-types.js";

let tmpDir: string;

const setupAssetsTmpDir = (): void => {
    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), "gtkx-assets-test-"));
    });
    afterEach(() => {
        rmSync(tmpDir, { recursive: true, force: true });
    });
};

const callResolveId = async (
    resolve: (source: string) => Promise<{ id: string; external?: boolean } | null>,
    source: string,
): Promise<string | undefined | null> => {
    const plugin = gtkxAssets();
    return (plugin.resolveId as ResolveIdHook).call({ resolve }, source);
};

describe("gtkxAssets (plugin shape)", () => {
    it("returns a plugin with the expected name and pre-enforce", () => {
        const plugin = gtkxAssets();
        expect(plugin.name).toBe("gtkx:assets");
        expect(plugin.enforce).toBe("pre");
    });
});

describe("gtkxAssets (resolveId)", () => {
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
        expect(result).toBe("\0gtkx:/abs/style.css?inject");
    });
});

describe("gtkxAssets (load)", () => {
    setupAssetsTmpDir();

    it("load injects CSS contents via injectGlobal for virtual ids", () => {
        const plugin = gtkxAssets();
        const cssPath = join(tmpDir, "style.css");
        writeFileSync(cssPath, "body { color: red; }");

        const out = (plugin.load as LoadHook)(`\0gtkx:${cssPath}?inject`);

        expect(out).toContain('import { injectGlobal } from "@gtkx/css";');
        expect(out).toContain(`injectGlobal(${JSON.stringify("body { color: red; }")});`);
    });

    it("load returns undefined for non-virtual ids (binary assets handled by gtkx:gresources)", () => {
        const plugin = gtkxAssets();
        expect((plugin.load as LoadHook)("/abs/path/logo.png")).toBeUndefined();
        expect((plugin.load as LoadHook)("/abs/path/module.ts")).toBeUndefined();
    });
});
