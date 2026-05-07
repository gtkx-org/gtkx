import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { gtkxAssets } from "../src/vite-plugin-gtkx-assets.js";

type ConfigHook = () => { assetsInclude: RegExp[] };
type ConfigResolvedHook = (config: { command: "build" | "serve" }) => void;
type ResolveIdHook = (
    this: {
        resolve: (
            source: string,
            importer?: string,
            opts?: unknown,
        ) => Promise<{ id: string; external?: boolean } | null>;
    },
    source: string,
    importer?: string,
    options?: unknown,
) => Promise<string | undefined | null>;
type LoadHook = (id: string) => string | undefined | null;

describe("gtkxAssets", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), "gtkx-assets-test-"));
    });

    afterEach(() => {
        rmSync(tmpDir, { recursive: true, force: true });
    });

    it("returns a plugin with the expected name and pre-enforce", () => {
        const plugin = gtkxAssets();
        expect(plugin.name).toBe("gtkx:assets");
        expect(plugin.enforce).toBe("pre");
    });

    it("config declares an assetsInclude regex covering known asset extensions", () => {
        const plugin = gtkxAssets();
        const result = (plugin.config as ConfigHook)();
        expect(result.assetsInclude).toHaveLength(1);
        const [regex] = result.assetsInclude;
        if (!regex) throw new Error("assetsInclude regex missing");
        expect(regex.test("logo.png")).toBe(true);
        expect(regex.test("song.mp3")).toBe(true);
        expect(regex.test("font.woff2")).toBe(true);
        expect(regex.test("data.json")).toBe(false);
    });

    it("resolveId ignores non-CSS sources", async () => {
        const plugin = gtkxAssets();
        const result = await (plugin.resolveId as ResolveIdHook).call(
            { resolve: () => Promise.resolve({ id: "" }) },
            "./image.png",
        );
        expect(result).toBeUndefined();
    });

    it("resolveId returns undefined when the resolved CSS is external", async () => {
        const plugin = gtkxAssets();
        const result = await (plugin.resolveId as ResolveIdHook).call(
            { resolve: () => Promise.resolve({ id: "/abs/style.css", external: true }) },
            "./style.css",
        );
        expect(result).toBeUndefined();
    });

    it("resolveId returns undefined when resolve yields null", async () => {
        const plugin = gtkxAssets();
        const result = await (plugin.resolveId as ResolveIdHook).call(
            { resolve: () => Promise.resolve(null) },
            "./style.css",
        );
        expect(result).toBeUndefined();
    });

    it("resolveId returns the virtual prefix for CSS imports", async () => {
        const plugin = gtkxAssets();
        const result = await (plugin.resolveId as ResolveIdHook).call(
            { resolve: () => Promise.resolve({ id: "/abs/style.css" }) },
            "./style.css",
        );
        expect(result).toBe("\0gtkx:/abs/style.css?inject");
    });

    it("load injects CSS contents via injectGlobal for virtual ids", () => {
        const plugin = gtkxAssets();
        const cssPath = join(tmpDir, "style.css");
        writeFileSync(cssPath, "body { color: red; }");

        const out = (plugin.load as LoadHook)(`\0gtkx:${cssPath}?inject`);

        expect(out).toContain('import { injectGlobal } from "@gtkx/css";');
        expect(out).toContain(`injectGlobal(${JSON.stringify("body { color: red; }")});`);
    });

    it("load returns an export-default path for asset ids in dev mode", () => {
        const plugin = gtkxAssets();
        (plugin.configResolved as ConfigResolvedHook).call({}, { command: "serve" });

        const result = (plugin.load as LoadHook)("/abs/path/logo.png");
        expect(result).toBe(`export default ${JSON.stringify("/abs/path/logo.png")};`);
    });

    it("load returns undefined for asset ids in build mode", () => {
        const plugin = gtkxAssets();
        (plugin.configResolved as ConfigResolvedHook).call({}, { command: "build" });

        const result = (plugin.load as LoadHook)("/abs/path/logo.png");
        expect(result).toBeUndefined();
    });

    it("load returns undefined for non-asset, non-virtual ids", () => {
        const plugin = gtkxAssets();
        (plugin.configResolved as ConfigResolvedHook).call({}, { command: "serve" });

        const result = (plugin.load as LoadHook)("/abs/path/module.ts");
        expect(result).toBeUndefined();
    });
});
