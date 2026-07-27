import { resolveExecutable } from "@gtkx/utils";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BuildEndHook, LoadHook, ResolveIdHook } from "./plugin-hook-types.js";
import {
    BUNDLE_FILENAME,
    REFRESH_EXPORT,
    REL_SEPARATOR,
    toVirtualId,
    VIRTUAL_INIT,
} from "../../src/vite-plugins/resource-shared.js";
import { gtkxResources } from "../../src/vite-plugins/resources.js";
import { expectBuildEndEmitsAsset, expectBuildEndIsNoop } from "./build-end-assertions.js";

type ConfigureServerHook = (this: unknown, server: unknown) => void;
type ConfigHook = (config: { root?: string }) => Promise<{ assetsInclude: RegExp[] }>;
type ConfigResolvedHook = (config: { command: "build" | "serve"; root: string }) => void;
type ResourcesPlugin = ReturnType<typeof gtkxResources>;

type FakeServer = {
    watcher: FakeEmitter;
    ssrLoadModule: ReturnType<typeof vi.fn>;
};

type WatcherHarness = {
    assetPath: string;
    server: FakeServer;
    refresh: ReturnType<typeof vi.fn>;
};

const TINY_PNG = Buffer.from([0x89, 0x50, 0x4E, 0x47]);
const tmpDir = { path: "" };

const hasGlibCompileResources = (): boolean => {
    try {
        execFileSync(resolveExecutable("glib-compile-resources"), ["--version"], {
            stdio: ["ignore", "ignore", "ignore"],
        });

        return true;
    } catch {
        return false;
    }
};

const dataAssetPath = (...segments: string[]): string => join(tmpDir.path, "data", ...segments);

const writeDataAsset = (relPath: string, bytes: Buffer): string => {
    const full = dataAssetPath(relPath);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, bytes);

    return full;
};

const virtualAssetId = (absPath: string, rel: string): string => toVirtualId(absPath) + REL_SEPARATOR + rel;

const initPlugin = async (
    plugin: ResourcesPlugin,
    command: "build" | "serve",
    root: string,
    applicationId = "org.gtkx.app",
): Promise<void> => {
    writeFileSync(
        join(root, "gtkx.config.ts"),
        `export default { applicationId: ${JSON.stringify(applicationId)} };\n`,
    );

    await (plugin.config as ConfigHook).call(plugin, { root });
    (plugin.configResolved as ConfigResolvedHook).call(plugin, { command, root });
};

const setupTmpDir = (): void => {
    beforeEach(() => {
        tmpDir.path = mkdtempSync(join(tmpdir(), "gtkx-resources-test-"));
    });

    afterEach(() => {
        rmSync(tmpDir.path, { recursive: true, force: true });
    });
};

const createFakeServer = (refresh: ReturnType<typeof vi.fn>): FakeServer => ({
    watcher: new FakeEmitter(),
    ssrLoadModule: vi.fn(() => Promise.resolve({ [REFRESH_EXPORT]: refresh })),
});

const waitTicks = async (n = 2): Promise<void> => {
    for (let i = 0; i < n; i++) {
        await new Promise((resolve) => setImmediate(resolve));
    }
};

const setupTrackedAssetServer = async (assetName: string): Promise<WatcherHarness> => {
    const plugin = gtkxResources();
    await initPlugin(plugin, "serve", tmpDir.path);
    const assetPath = writeDataAsset(assetName, TINY_PNG);
    (plugin.load as LoadHook)(virtualAssetId(assetPath, assetName));
    const refresh = vi.fn();
    const server = createFakeServer(refresh);
    (plugin.configureServer as ConfigureServerHook).call(plugin, server);

    return { assetPath, server, refresh };
};

class FakeEmitter {
    #listeners: Map<string, ((...args: unknown[]) => void)[]> = new Map();

    on(event: string, listener: (...args: unknown[]) => void): void {
        const entries = this.#listeners.get(event) ?? [];
        entries.push(listener);
        this.#listeners.set(event, entries);
    }

    emit(event: string, ...args: unknown[]): void {
        const listeners = this.#listeners.get(event) ?? [];

        for (const listener of listeners) {
            listener(...args);
        }
    }
}

describe("gtkxResources (plugin shape)", () => {
    it("returns a plugin with the expected name and pre-enforce", () => {
        const plugin = gtkxResources();
        expect(plugin.name).toBe("gtkx:resources");
        expect(plugin.enforce).toBe("pre");
    });

    it("config declares an assetsInclude regex covering known asset extensions", async () => {
        const plugin = gtkxResources();
        const root = mkdtempSync(join(tmpdir(), "gtkx-resources-test-"));
        writeFileSync(join(root, "gtkx.config.ts"), "export default { applicationId: \"org.gtkx.app\" };\n");

        try {
            const result = await (plugin.config as ConfigHook).call(plugin, { root });
            expect(result.assetsInclude).toHaveLength(1);
            const [regex] = result.assetsInclude;

            if (!regex) {
                throw new Error("assetsInclude regex missing");
            }

            expect(regex.test("logo.png")).toBe(true);
            expect(regex.test("song.mp3")).toBe(true);
            expect(regex.test("font.woff2")).toBe(true);
            expect(regex.test("data.json")).toBe(false);
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });
});

describe("gtkxResources (resolveId)", () => {
    it("returns the virtual init id directly", async () => {
        const plugin = gtkxResources();

        const result = await (plugin.resolveId as ResolveIdHook).call(
            { resolve: () => Promise.resolve({ id: "" }) },
            VIRTUAL_INIT,
        );

        expect(result).toBe(VIRTUAL_INIT);
    });

    it("ignores non-asset sources", async () => {
        const plugin = gtkxResources();

        const result = await (plugin.resolveId as ResolveIdHook).call(
            { resolve: () => Promise.resolve({ id: "" }) },
            "#data/some.module.ts",
        );

        expect(result).toBeUndefined();
    });

    it("ignores asset imports that are not rooted at #data/", async () => {
        const plugin = gtkxResources();

        const result = await (plugin.resolveId as ResolveIdHook).call(
            { resolve: () => Promise.resolve({ id: "/abs/logo.png" }) },
            "./logo.png",
        );

        expect(result).toBeUndefined();
    });

    it("rewrites a #data asset import to the virtual prefix, carrying the relative path", async () => {
        const plugin = gtkxResources();

        const result = await (plugin.resolveId as ResolveIdHook).call(
            { resolve: () => Promise.resolve({ id: "/abs/data/icons/logo.png" }) },
            "#data/icons/logo.png",
        );

        expect(result).toBe(`${toVirtualId("/abs/data/icons/logo.png") + REL_SEPARATOR}icons/logo.png`);
    });

    it("returns undefined when resolve marks the asset external", async () => {
        const plugin = gtkxResources();

        const result = await (plugin.resolveId as ResolveIdHook).call(
            { resolve: () => Promise.resolve({ id: "/abs/logo.png", external: true }) },
            "#data/logo.png",
        );

        expect(result).toBeUndefined();
    });

    it("strips a query string before resolving and carries the relative path", async () => {
        const plugin = gtkxResources();
        const resolve = vi.fn(() => Promise.resolve({ id: "/abs/data/logo.png" }));
        const result = await (plugin.resolveId as ResolveIdHook).call({ resolve }, "#data/logo.png?inline");
        expect(resolve).toHaveBeenCalledWith("#data/logo.png", undefined, expect.objectContaining({ skipSelf: true }));
        expect(result).toBe(`${toVirtualId("/abs/data/logo.png") + REL_SEPARATOR}logo.png`);
    });
});

describe("gtkxResources (init module)", () => {
    setupTmpDir();

    it("renders the build-mode init module with a Resource.load bootstrap", async () => {
        const plugin = gtkxResources();
        await initPlugin(plugin, "build", tmpDir.path, "org.gtk.Demo4");
        const out = (plugin.load as LoadHook)(VIRTUAL_INIT) as string;
        expect(out).toContain("Resource.load");
        expect(out).toContain("resourcesRegister");
        expect(out).toContain(BUNDLE_FILENAME);
        expect(out).toContain("import.meta.url");
        expect(out).toContain("export function ensureRegistered");
    });

    it.skipIf(!hasGlibCompileResources())(
        "renders the dev-mode init module with a refresh-capable Resource.load",
        async () => {
            const plugin = gtkxResources();
            await initPlugin(plugin, "serve", tmpDir.path, "org.gtk.Demo4");
            const assetPath = writeDataAsset("logo.png", Buffer.from([0x89, 0x50, 0x4E, 0x47]));
            (plugin.load as LoadHook)(virtualAssetId(assetPath, "logo.png"));
            const out = (plugin.load as LoadHook)(VIRTUAL_INIT) as string;
            expect(out).toContain("resourcesUnregister");
            expect(out).toContain("ensureRegistered");
            expect(out).toContain(REFRESH_EXPORT);
            expect(out).toContain("gtkx-resources-dev-");
        },
    );
});

describe("gtkxResources (resource prefix)", () => {
    setupTmpDir();

    it("derives the resource prefix from the configured applicationId", async () => {
        const plugin = gtkxResources();
        await initPlugin(plugin, "build", tmpDir.path);
        const assetPath = dataAssetPath("icons", "foo.svg");
        const out = (plugin.load as LoadHook)(virtualAssetId(assetPath, "icons/foo.svg")) as string;
        expect(out).toContain("export const path = \"/org/gtkx/app/icons/foo.svg\";");
    });
});

describe("gtkxResources (asset load)", () => {
    setupTmpDir();

    it("returns undefined for non-virtual ids", async () => {
        const plugin = gtkxResources();
        await initPlugin(plugin, "build", tmpDir.path);
        expect((plugin.load as LoadHook)("/abs/path/foo.ts")).toBeUndefined();
    });

    it("rewrites a #data asset import to a resource URI under the app prefix", async () => {
        const plugin = gtkxResources();
        await initPlugin(plugin, "build", tmpDir.path, "org.gtk.Demo4");
        const assetPath = dataAssetPath("icons", "foo.svg");
        const out = (plugin.load as LoadHook)(virtualAssetId(assetPath, "icons/foo.svg")) as string;
        expect(out).toContain(String.raw`import { ensureRegistered } from "\u0000gtkx-resources-init";`);
        expect(out).toContain("ensureRegistered();");
        expect(out).toContain("export default \"resource:///org/gtk/Demo4/icons/foo.svg\";");
        expect(out).toContain("export const path = \"/org/gtk/Demo4/icons/foo.svg\";");
    });

    it("lands a top-level #data asset at the resource base path", async () => {
        const plugin = gtkxResources();
        await initPlugin(plugin, "build", tmpDir.path, "org.gtk.Demo4");
        const assetPath = dataAssetPath("style.css");
        const out = (plugin.load as LoadHook)(virtualAssetId(assetPath, "style.css")) as string;
        expect(out).toContain("export const path = \"/org/gtk/Demo4/style.css\";");
    });
});

describe("gtkxResources (buildEnd)", () => {
    setupTmpDir();

    it("is a no-op when no assets were imported", async () => {
        const plugin = gtkxResources();
        await initPlugin(plugin, "build", tmpDir.path);
        expectBuildEndIsNoop(plugin.buildEnd as BuildEndHook);
    });

    it.skipIf(!hasGlibCompileResources())("compiles tracked assets into a single .gresource and emits it", async () => {
        const plugin = gtkxResources();
        await initPlugin(plugin, "build", tmpDir.path, "org.gtk.Demo4");
        const assetPath = writeDataAsset("logo.png", Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]));
        (plugin.load as LoadHook)(virtualAssetId(assetPath, "logo.png"));
        expectBuildEndEmitsAsset(plugin.buildEnd as BuildEndHook, BUNDLE_FILENAME);
    });
});

describe("gtkxResources (watcher: change event)", () => {
    setupTmpDir();

    it.skipIf(!hasGlibCompileResources())(
        "re-registers the GResource bundle when a tracked asset changes",
        async () => {
            const { assetPath, server, refresh } = await setupTrackedAssetServer("icon.png");
            server.watcher.emit("change", assetPath);
            await waitTicks();
            expect(server.ssrLoadModule).toHaveBeenCalledWith(VIRTUAL_INIT);
            expect(refresh).toHaveBeenCalled();
        },
    );
});

describe("gtkxResources (watcher: add event)", () => {
    setupTmpDir();

    it.skipIf(!hasGlibCompileResources())(
        "re-registers the bundle on the 'add' watcher event for a tracked asset",
        async () => {
            const { assetPath, server, refresh } = await setupTrackedAssetServer("addme.png");
            server.watcher.emit("add", assetPath);
            await waitTicks();
            expect(refresh).toHaveBeenCalled();
        },
    );
});

describe("gtkxResources (watcher: untracked event)", () => {
    setupTmpDir();

    it("ignores file events for untracked paths", async () => {
        const plugin = gtkxResources();
        await initPlugin(plugin, "serve", tmpDir.path);
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

describe("gtkxResources (watcher: refresh failure)", () => {
    setupTmpDir();

    it.skipIf(!hasGlibCompileResources())("logs and swallows refresh errors so the watcher keeps running", async () => {
        const plugin = gtkxResources();
        await initPlugin(plugin, "serve", tmpDir.path);
        const assetPath = writeDataAsset("broken.png", TINY_PNG);
        (plugin.load as LoadHook)(virtualAssetId(assetPath, "broken.png"));
        const watcher = new FakeEmitter();

        const server = {
            watcher,
            ssrLoadModule: vi.fn(() => Promise.reject(new Error("ssr boom"))),
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
