import { execFileSync } from "node:child_process";
import { EventEmitter } from "node:events";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    BUNDLE_FILENAME,
    escapeXml,
    REL_SEPARATOR,
    toVirtualId,
    VIRTUAL_INIT,
} from "../../src/vite-plugins/gresource-shared.js";
import { gtkxGResources } from "../../src/vite-plugins/gresources.js";
import { expectBuildEndEmitsAsset, expectBuildEndIsNoop } from "./_vite-plugin-fixture.js";

import type { BuildEndHook, LoadHook, ResolveIdHook } from "./plugin-hook-types.js";

type ConfigureServerHook = (this: unknown, server: unknown) => void;

type ConfigHook = (config: { root?: string }) => Promise<{ assetsInclude: RegExp[] }>;
type ConfigResolvedHook = (config: { command: "build" | "serve"; root: string }) => void;

type GresourcesPlugin = ReturnType<typeof gtkxGResources>;

const hasGlibCompileResources = (): boolean => {
    try {
        execFileSync("glib-compile-resources", ["--version"], { stdio: ["ignore", "ignore", "ignore"] });
        return true;
    } catch {
        return false;
    }
};

let tmpDir: string;

const dataAssetPath = (...segments: string[]): string => join(tmpDir, "data", ...segments);

const writeDataAsset = (relPath: string, bytes: Buffer): string => {
    const full = dataAssetPath(relPath);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, bytes);
    return full;
};

const virtualAssetId = (absPath: string, rel: string): string => toVirtualId(absPath) + REL_SEPARATOR + rel;

const initPlugin = async (
    plugin: GresourcesPlugin,
    command: "build" | "serve",
    root: string,
    applicationId?: string,
): Promise<void> => {
    writeFileSync(
        join(root, "gtkx.config.ts"),
        applicationId === undefined
            ? "export default {};\n"
            : `export default { applicationId: ${JSON.stringify(applicationId)} };\n`,
    );
    await (plugin.config as ConfigHook).call(plugin, { root });
    (plugin.configResolved as ConfigResolvedHook).call(plugin, { command, root });
};

const setupTmpDir = (): void => {
    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), "gtkx-gresources-test-"));
    });
    afterEach(() => {
        rmSync(tmpDir, { recursive: true, force: true });
    });
};

describe("gtkxGResources (plugin shape)", () => {
    it("returns a plugin with the expected name and pre-enforce", () => {
        const plugin = gtkxGResources();
        expect(plugin.name).toBe("gtkx:gresources");
        expect(plugin.enforce).toBe("pre");
    });

    it("config declares an assetsInclude regex covering known asset extensions", async () => {
        const plugin = gtkxGResources();
        const result = await (plugin.config as ConfigHook).call(plugin, {});
        expect(result.assetsInclude).toHaveLength(1);
        const [regex] = result.assetsInclude;
        if (!regex) throw new Error("assetsInclude regex missing");
        expect(regex.test("logo.png")).toBe(true);
        expect(regex.test("song.mp3")).toBe(true);
        expect(regex.test("font.woff2")).toBe(true);
        expect(regex.test("data.json")).toBe(false);
    });
});

describe("gtkxGResources (resolveId)", () => {
    it("returns the virtual init id directly", async () => {
        const plugin = gtkxGResources();
        const result = await (plugin.resolveId as ResolveIdHook).call(
            { resolve: () => Promise.resolve({ id: "" }) },
            VIRTUAL_INIT,
        );
        expect(result).toBe(VIRTUAL_INIT);
    });

    it("ignores non-asset sources", async () => {
        const plugin = gtkxGResources();
        const result = await (plugin.resolveId as ResolveIdHook).call(
            { resolve: () => Promise.resolve({ id: "" }) },
            "#data/some.module.ts",
        );
        expect(result).toBeUndefined();
    });

    it("ignores asset imports that are not rooted at #data/", async () => {
        const plugin = gtkxGResources();
        const result = await (plugin.resolveId as ResolveIdHook).call(
            { resolve: () => Promise.resolve({ id: "/abs/logo.png" }) },
            "./logo.png",
        );
        expect(result).toBeUndefined();
    });

    it("rewrites a #data asset import to the virtual prefix, carrying the relative path", async () => {
        const plugin = gtkxGResources();
        const result = await (plugin.resolveId as ResolveIdHook).call(
            { resolve: () => Promise.resolve({ id: "/abs/data/icons/logo.png" }) },
            "#data/icons/logo.png",
        );
        expect(result).toBe(`${toVirtualId("/abs/data/icons/logo.png") + REL_SEPARATOR}icons/logo.png`);
    });

    it("returns undefined when resolve marks the asset external", async () => {
        const plugin = gtkxGResources();
        const result = await (plugin.resolveId as ResolveIdHook).call(
            { resolve: () => Promise.resolve({ id: "/abs/logo.png", external: true }) },
            "#data/logo.png",
        );
        expect(result).toBeUndefined();
    });

    it("strips a query string before resolving and carries the relative path", async () => {
        const plugin = gtkxGResources();
        const resolve = vi.fn(() => Promise.resolve({ id: "/abs/data/logo.png" }));
        const result = await (plugin.resolveId as ResolveIdHook).call({ resolve }, "#data/logo.png?inline");
        expect(resolve).toHaveBeenCalledWith("#data/logo.png", undefined, expect.objectContaining({ skipSelf: true }));
        expect(result).toBe(`${toVirtualId("/abs/data/logo.png") + REL_SEPARATOR}logo.png`);
    });
});

describe("gtkxGResources (init module)", () => {
    setupTmpDir();

    it("renders the build-mode init module with resourceLoad bootstrap", async () => {
        const plugin = gtkxGResources();
        await initPlugin(plugin, "build", tmpDir, "org.gtk.Demo4");

        const out = (plugin.load as LoadHook)(VIRTUAL_INIT) as string;
        expect(out).toContain("resourceLoad");
        expect(out).toContain("resourcesRegister");
        expect(out).toContain(BUNDLE_FILENAME);
        expect(out).toContain("import.meta.url");
        expect(out).toContain("export function ensureRegistered");
    });

    it("renders the dev-mode init module with refresh-capable resourceLoad", async () => {
        if (!hasGlibCompileResources()) return;

        const plugin = gtkxGResources();
        await initPlugin(plugin, "serve", tmpDir, "org.gtk.Demo4");

        const assetPath = writeDataAsset("logo.png", Buffer.from([0x89, 0x50, 0x4e, 0x47]));
        (plugin.load as LoadHook)(virtualAssetId(assetPath, "logo.png"));

        const out = (plugin.load as LoadHook)(VIRTUAL_INIT) as string;
        expect(out).toContain("resourcesUnregister");
        expect(out).toContain("ensureRegistered");
        expect(out).toContain("__refresh");
        expect(out).toContain("gtkx-gresources-dev-");
    });
});

describe("gtkxGResources (default prefix)", () => {
    setupTmpDir();

    it("uses the default org.gtkx.app prefix when no applicationId is configured", async () => {
        const plugin = gtkxGResources();
        await initPlugin(plugin, "build", tmpDir);

        const assetPath = dataAssetPath("icons", "foo.svg");
        const out = (plugin.load as LoadHook)(virtualAssetId(assetPath, "icons/foo.svg")) as string;

        expect(out).toContain(`export const path = "/org/gtkx/app/icons/foo.svg";`);
    });
});

describe("gtkxGResources (asset load)", () => {
    setupTmpDir();

    it("returns undefined for non-virtual ids", async () => {
        const plugin = gtkxGResources();
        await initPlugin(plugin, "build", tmpDir);
        expect((plugin.load as LoadHook)("/abs/path/foo.ts")).toBeUndefined();
    });

    it("rewrites a #data asset import to a resource URI under the app prefix", async () => {
        const plugin = gtkxGResources();
        await initPlugin(plugin, "build", tmpDir, "org.gtk.Demo4");

        const assetPath = dataAssetPath("icons", "foo.svg");
        const out = (plugin.load as LoadHook)(virtualAssetId(assetPath, "icons/foo.svg")) as string;

        expect(out).toContain('import { ensureRegistered } from "\\u0000gtkx-gresources-init";');
        expect(out).toContain("ensureRegistered();");
        expect(out).toContain(`export default "resource:///org/gtk/Demo4/icons/foo.svg";`);
        expect(out).toContain(`export const path = "/org/gtk/Demo4/icons/foo.svg";`);
    });

    it("lands a top-level #data asset at the resource base path", async () => {
        const plugin = gtkxGResources();
        await initPlugin(plugin, "build", tmpDir, "org.gtk.Demo4");

        const assetPath = dataAssetPath("style.css");
        const out = (plugin.load as LoadHook)(virtualAssetId(assetPath, "style.css")) as string;

        expect(out).toContain(`export const path = "/org/gtk/Demo4/style.css";`);
    });
});

describe("gtkxGResources (buildEnd)", () => {
    setupTmpDir();

    it("is a no-op when no assets were imported", async () => {
        const plugin = gtkxGResources();
        await initPlugin(plugin, "build", tmpDir);

        expectBuildEndIsNoop(plugin.buildEnd as BuildEndHook);
    });

    it("compiles tracked assets into a single .gresource and emits it", async () => {
        if (!hasGlibCompileResources()) return;

        const plugin = gtkxGResources();
        await initPlugin(plugin, "build", tmpDir, "org.gtk.Demo4");

        const assetPath = writeDataAsset("logo.png", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
        (plugin.load as LoadHook)(virtualAssetId(assetPath, "logo.png"));

        expectBuildEndEmitsAsset(plugin.buildEnd as BuildEndHook, BUNDLE_FILENAME);
    });
});

type FakeServer = {
    watcher: EventEmitter;
    ssrLoadModule: ReturnType<typeof vi.fn>;
};

const createFakeServer = (refresh: ReturnType<typeof vi.fn>): FakeServer => ({
    watcher: new EventEmitter(),
    ssrLoadModule: vi.fn(async () => ({ __refresh: refresh })),
});

const waitTicks = async (n = 2): Promise<void> => {
    for (let i = 0; i < n; i++) {
        await new Promise((resolve) => setImmediate(resolve));
    }
};

const TINY_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

type WatcherHarness = {
    assetPath: string;
    server: FakeServer;
    refresh: ReturnType<typeof vi.fn>;
};

const setupTrackedAssetServer = async (assetName: string): Promise<WatcherHarness> => {
    const plugin = gtkxGResources();
    await initPlugin(plugin, "serve", tmpDir);

    const assetPath = writeDataAsset(assetName, TINY_PNG);
    (plugin.load as LoadHook)(virtualAssetId(assetPath, assetName));

    const refresh = vi.fn();
    const server = createFakeServer(refresh);
    (plugin.configureServer as ConfigureServerHook).call(plugin, server);

    return { assetPath, server, refresh };
};

describe("gtkxGResources (watcher: change event)", () => {
    setupTmpDir();

    it("re-registers the GResource bundle when a tracked asset changes", async () => {
        if (!hasGlibCompileResources()) return;

        const { assetPath, server, refresh } = await setupTrackedAssetServer("icon.png");

        server.watcher.emit("change", assetPath);
        await waitTicks();

        expect(server.ssrLoadModule).toHaveBeenCalledWith(VIRTUAL_INIT);
        expect(refresh).toHaveBeenCalled();
    });
});

describe("gtkxGResources (watcher: add event)", () => {
    setupTmpDir();

    it("re-registers the bundle on the 'add' watcher event for a tracked asset", async () => {
        if (!hasGlibCompileResources()) return;

        const { assetPath, server, refresh } = await setupTrackedAssetServer("addme.png");

        server.watcher.emit("add", assetPath);
        await waitTicks();

        expect(refresh).toHaveBeenCalled();
    });
});

describe("gtkxGResources (watcher: untracked event)", () => {
    setupTmpDir();

    it("ignores file events for untracked paths", async () => {
        const plugin = gtkxGResources();
        await initPlugin(plugin, "serve", tmpDir);

        const refresh = vi.fn();
        const server = createFakeServer(refresh);
        (plugin.configureServer as ConfigureServerHook).call(plugin, server);

        server.watcher.emit("change", "/nothing/here.png");
        server.watcher.emit("add", "/nothing/added.png");
        await waitTicks(1);

        expect(server.ssrLoadModule).not.toHaveBeenCalled();
        expect(refresh).not.toHaveBeenCalled();
    });
});

describe("gtkxGResources (watcher: refresh failure)", () => {
    setupTmpDir();

    it("logs and swallows refresh errors so the watcher keeps running", async () => {
        if (!hasGlibCompileResources()) return;

        const plugin = gtkxGResources();
        await initPlugin(plugin, "serve", tmpDir);

        const assetPath = writeDataAsset("broken.png", TINY_PNG);
        (plugin.load as LoadHook)(virtualAssetId(assetPath, "broken.png"));

        const watcher = new EventEmitter();
        const server = {
            watcher,
            ssrLoadModule: vi.fn(async () => {
                throw new Error("ssr boom");
            }),
        };

        const errSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
        try {
            (plugin.configureServer as ConfigureServerHook).call(plugin, server);

            server.watcher.emit("change", assetPath);
            await waitTicks();

            const written = errSpy.mock.calls.map((call) => String(call[0])).join("");
            expect(written).toContain("Failed to refresh GResource bundle");
        } finally {
            errSpy.mockRestore();
        }
    });
});

describe("escapeXml (internal)", () => {
    it("escapes < to &lt;", () => {
        expect(escapeXml("<root>")).toBe("&lt;root&gt;");
    });

    it("escapes & to &amp;", () => {
        expect(escapeXml("a & b")).toBe("a &amp; b");
    });

    it("escapes the double quote to &quot;", () => {
        expect(escapeXml('say "hi"')).toBe("say &quot;hi&quot;");
    });

    it("escapes the apostrophe to &apos;", () => {
        expect(escapeXml("it's")).toBe("it&apos;s");
    });

    it("leaves a plain alphanumeric string untouched", () => {
        expect(escapeXml("plain text 123")).toBe("plain text 123");
    });

    it("escapes a string containing every reserved character", () => {
        expect(escapeXml(`<a & b="c">'`)).toBe("&lt;a &amp; b=&quot;c&quot;&gt;&apos;");
    });
});
