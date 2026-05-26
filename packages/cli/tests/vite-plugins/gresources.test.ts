import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    __TEST_BUNDLE_FILENAME,
    __TEST_VIRTUAL_INIT,
    __TEST_VIRTUAL_PREFIX,
    deriveResourcePrefix,
    gtkxResources,
} from "../../src/vite-plugins/gresources.js";

import type { BuildEndHook, LoadHook, ResolveIdHook } from "./plugin-hook-types.js";

type ConfigHook = () => { assetsInclude: RegExp[] };
type ConfigResolvedHook = (config: { command: "build" | "serve"; root: string }) => void;

const hasGlibCompileResources = (): boolean => {
    try {
        execFileSync("glib-compile-resources", ["--version"], { stdio: ["ignore", "ignore", "ignore"] });
        return true;
    } catch {
        return false;
    }
};

let tmpDir: string;

const setupTmpDir = (): void => {
    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), "gtkx-gresources-test-"));
    });
    afterEach(() => {
        rmSync(tmpDir, { recursive: true, force: true });
    });
};

describe("deriveResourcePrefix", () => {
    it("converts a dotted app id into a slash path", () => {
        expect(deriveResourcePrefix("org.gtk.Demo4")).toBe("/org/gtk/Demo4");
    });

    it("falls back to /gtkx/app when no id is supplied", () => {
        expect(deriveResourcePrefix(undefined)).toBe("/gtkx/app");
        expect(deriveResourcePrefix("")).toBe("/gtkx/app");
    });

    it("preserves hyphens in segments", () => {
        expect(deriveResourcePrefix("org.gtkx.gtk-demo")).toBe("/org/gtkx/gtk-demo");
    });
});

describe("gtkxResources (plugin shape)", () => {
    it("returns a plugin with the expected name and pre-enforce", () => {
        const plugin = gtkxResources();
        expect(plugin.name).toBe("gtkx:gresources");
        expect(plugin.enforce).toBe("pre");
    });

    it("config declares an assetsInclude regex covering known asset extensions", () => {
        const plugin = gtkxResources();
        const result = (plugin.config as ConfigHook)();
        expect(result.assetsInclude).toHaveLength(1);
        const [regex] = result.assetsInclude;
        if (!regex) throw new Error("assetsInclude regex missing");
        expect(regex.test("logo.png")).toBe(true);
        expect(regex.test("song.mp3")).toBe(true);
        expect(regex.test("font.woff2")).toBe(true);
        expect(regex.test("data.json")).toBe(false);
    });
});

describe("gtkxResources (resolveId)", () => {
    it("returns the virtual init id directly", async () => {
        const plugin = gtkxResources();
        const result = await (plugin.resolveId as ResolveIdHook).call(
            { resolve: () => Promise.resolve({ id: "" }) },
            __TEST_VIRTUAL_INIT,
        );
        expect(result).toBe(__TEST_VIRTUAL_INIT);
    });

    it("ignores non-asset sources", async () => {
        const plugin = gtkxResources();
        const result = await (plugin.resolveId as ResolveIdHook).call(
            { resolve: () => Promise.resolve({ id: "" }) },
            "./some.module.ts",
        );
        expect(result).toBeUndefined();
    });

    it("rewrites asset imports to the virtual prefix", async () => {
        const plugin = gtkxResources();
        const result = await (plugin.resolveId as ResolveIdHook).call(
            { resolve: () => Promise.resolve({ id: "/abs/logo.png" }) },
            "./logo.png",
        );
        expect(result).toBe(`${__TEST_VIRTUAL_PREFIX}/abs/logo.png`);
    });

    it("returns undefined when resolve marks the asset external", async () => {
        const plugin = gtkxResources();
        const result = await (plugin.resolveId as ResolveIdHook).call(
            { resolve: () => Promise.resolve({ id: "/abs/logo.png", external: true }) },
            "./logo.png",
        );
        expect(result).toBeUndefined();
    });

    it("matches asset paths even when a query string is appended", async () => {
        const plugin = gtkxResources();
        const result = await (plugin.resolveId as ResolveIdHook).call(
            { resolve: () => Promise.resolve({ id: "/abs/logo.png?import" }) },
            "./logo.png?import",
        );
        expect(result).toBe(`${__TEST_VIRTUAL_PREFIX}/abs/logo.png?import`);
    });
});

describe("gtkxResources (init module)", () => {
    setupTmpDir();

    it("renders the build-mode init module with resourceLoad bootstrap", () => {
        const plugin = gtkxResources({ applicationId: "org.gtk.Demo4" });
        (plugin.configResolved as ConfigResolvedHook).call({}, { command: "build", root: tmpDir });

        const out = (plugin.load as LoadHook)(__TEST_VIRTUAL_INIT) as string;
        expect(out).toContain("resourceLoad");
        expect(out).toContain("resourcesRegister");
        expect(out).toContain(__TEST_BUNDLE_FILENAME);
        expect(out).toContain("import.meta.url");
        expect(out).toContain("export function ensureRegistered");
    });

    it("renders the dev-mode init module with refresh-capable resourceLoad", () => {
        if (!hasGlibCompileResources()) return;

        const plugin = gtkxResources({ applicationId: "org.gtk.Demo4" });
        (plugin.configResolved as ConfigResolvedHook).call({}, { command: "serve", root: tmpDir });

        const assetPath = join(tmpDir, "logo.png");
        writeFileSync(assetPath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
        (plugin.load as LoadHook)(`${__TEST_VIRTUAL_PREFIX}${assetPath}`);

        const out = (plugin.load as LoadHook)(__TEST_VIRTUAL_INIT) as string;
        expect(out).toContain("resourcesUnregister");
        expect(out).toContain("ensureRegistered");
        expect(out).toContain("__refresh");
        expect(out).toContain("gtkx-gresources-dev-");
    });
});

describe("gtkxResources (asset load)", () => {
    setupTmpDir();

    it("returns undefined for non-virtual ids", () => {
        const plugin = gtkxResources();
        (plugin.configResolved as ConfigResolvedHook).call({}, { command: "build", root: tmpDir });
        expect((plugin.load as LoadHook)("/abs/path/foo.ts")).toBeUndefined();
    });

    it("rewrites a tracked asset import to a resource URI in build mode", () => {
        const plugin = gtkxResources({ applicationId: "org.gtk.Demo4" });
        (plugin.configResolved as ConfigResolvedHook).call({}, { command: "build", root: tmpDir });

        const assetPath = join(tmpDir, "src/icons/foo.svg");
        const out = (plugin.load as LoadHook)(`${__TEST_VIRTUAL_PREFIX}${assetPath}`) as string;

        expect(out).toContain('import { ensureRegistered } from "\\u0000gtkx-gresources-init";');
        expect(out).toContain("ensureRegistered();");
        expect(out).toContain(`export default "resource:///org/gtk/Demo4/src/icons/foo.svg";`);
        expect(out).toContain(`export const path = "/org/gtk/Demo4/src/icons/foo.svg";`);
    });

    it("rejects assets outside the Vite root", () => {
        const plugin = gtkxResources({ applicationId: "org.gtk.Demo4" });
        (plugin.configResolved as ConfigResolvedHook).call({}, { command: "build", root: tmpDir });

        const outsidePath = join(tmpDir, "..", "outside.png");
        expect(() => (plugin.load as LoadHook)(`${__TEST_VIRTUAL_PREFIX}${outsidePath}`)).toThrow(
            /outside the Vite root/,
        );
    });
});

describe("gtkxResources (buildEnd)", () => {
    setupTmpDir();

    it("is a no-op when no assets were imported", () => {
        const plugin = gtkxResources();
        (plugin.configResolved as ConfigResolvedHook).call({}, { command: "build", root: tmpDir });

        const emitFile = vi.fn();
        expect(() => (plugin.buildEnd as BuildEndHook).call({ emitFile })).not.toThrow();
        expect(emitFile).not.toHaveBeenCalled();
    });

    it("compiles tracked assets into a single .gresource and emits it", () => {
        if (!hasGlibCompileResources()) return;

        const plugin = gtkxResources({ applicationId: "org.gtk.Demo4" });
        (plugin.configResolved as ConfigResolvedHook).call({}, { command: "build", root: tmpDir });

        const assetPath = join(tmpDir, "logo.png");
        writeFileSync(assetPath, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
        (plugin.load as LoadHook)(`${__TEST_VIRTUAL_PREFIX}${assetPath}`);

        const emitFile = vi.fn();
        (plugin.buildEnd as BuildEndHook).call({ emitFile });

        expect(emitFile).toHaveBeenCalledTimes(1);
        const call = emitFile.mock.calls[0]?.[0];
        expect(call).toBeDefined();
        expect(call.type).toBe("asset");
        expect(call.fileName).toBe(__TEST_BUNDLE_FILENAME);
        expect(Buffer.isBuffer(call.source)).toBe(true);
        expect(call.source.length).toBeGreaterThan(0);
    });
});
