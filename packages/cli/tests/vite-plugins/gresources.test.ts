import { execFileSync } from "node:child_process";
import { EventEmitter } from "node:events";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    BUNDLE_FILENAME,
    escapeXml,
    OVERRIDE_SEPARATOR,
    VIRTUAL_INIT,
    VIRTUAL_PREFIX,
} from "../../src/vite-plugins/gresource-protocol.js";
import { deriveResourcePrefix, gtkxResources } from "../../src/vite-plugins/gresources.js";

import type { BuildEndHook, LoadHook, ResolveIdHook } from "./plugin-hook-types.js";

type ConfigureServerHook = (this: unknown, server: unknown) => void;

type ConfigHook = (config: { root?: string }) => Promise<{ assetsInclude: RegExp[]; define: Record<string, string> }>;
type ConfigResolvedHook = (config: { command: "build" | "serve"; root: string }) => void;

type GresourcesPlugin = ReturnType<typeof gtkxResources>;

const hasGlibCompileResources = (): boolean => {
    try {
        execFileSync("glib-compile-resources", ["--version"], { stdio: ["ignore", "ignore", "ignore"] });
        return true;
    } catch {
        return false;
    }
};

let tmpDir: string;

const writeAppConfig = (root: string, applicationId: string): void => {
    writeFileSync(
        join(root, "gtkx.config.ts"),
        `export default { applicationId: ${JSON.stringify(applicationId)} };\n`,
    );
};

/**
 * Drives the plugin's async `config` hook (which self-loads `applicationId`
 * from `gtkx.config.ts`) followed by `configResolved`, mirroring Vite's own
 * lifecycle so `load` sees the resolved prefix.
 */
const initPlugin = async (
    plugin: GresourcesPlugin,
    command: "build" | "serve",
    root: string,
    applicationId?: string,
): Promise<void> => {
    if (applicationId !== undefined) writeAppConfig(root, applicationId);
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

    it("config declares an assetsInclude regex covering known asset extensions", async () => {
        const plugin = gtkxResources();
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

describe("gtkxResources (define)", () => {
    setupTmpDir();

    it("exposes the configured applicationId as import.meta.env.GTKX_APP_ID", async () => {
        writeAppConfig(tmpDir, "org.gtk.Demo4");
        const plugin = gtkxResources();
        const result = await (plugin.config as ConfigHook).call(plugin, { root: tmpDir });
        expect(result.define).toEqual({
            "import.meta.env.GTKX_APP_ID": JSON.stringify("org.gtk.Demo4"),
        });
    });

    it("defaults GTKX_APP_ID to the empty string when no config is present", async () => {
        const plugin = gtkxResources();
        const result = await (plugin.config as ConfigHook).call(plugin, { root: tmpDir });
        expect(result.define).toEqual({
            "import.meta.env.GTKX_APP_ID": JSON.stringify(""),
        });
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
        expect(result).toBe(`${VIRTUAL_PREFIX}/abs/logo.png`);
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
        expect(result).toBe(`${VIRTUAL_PREFIX}/abs/logo.png?import`);
    });

    it("strips a ?resource= query before resolving and encodes the override", async () => {
        const plugin = gtkxResources();
        const resolve = vi.fn(() => Promise.resolve({ id: "/abs/logo.png" }));
        const result = await (plugin.resolveId as ResolveIdHook).call(
            { resolve },
            "./logo.png?resource=icons/logo.png",
        );
        expect(resolve).toHaveBeenCalledWith("./logo.png", undefined, expect.objectContaining({ skipSelf: true }));
        expect(result).toBe(`${VIRTUAL_PREFIX}/abs/logo.png${OVERRIDE_SEPARATOR}icons/logo.png`);
    });
});

describe("gtkxResources (init module)", () => {
    setupTmpDir();

    it("renders the build-mode init module with resourceLoad bootstrap", async () => {
        const plugin = gtkxResources();
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

        const plugin = gtkxResources();
        await initPlugin(plugin, "serve", tmpDir, "org.gtk.Demo4");

        const assetPath = join(tmpDir, "logo.png");
        writeFileSync(assetPath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
        (plugin.load as LoadHook)(`${VIRTUAL_PREFIX}${assetPath}`);

        const out = (plugin.load as LoadHook)(VIRTUAL_INIT) as string;
        expect(out).toContain("resourcesUnregister");
        expect(out).toContain("ensureRegistered");
        expect(out).toContain("__refresh");
        expect(out).toContain("gtkx-gresources-dev-");
    });
});

describe("gtkxResources (asset load)", () => {
    setupTmpDir();

    it("returns undefined for non-virtual ids", async () => {
        const plugin = gtkxResources();
        await initPlugin(plugin, "build", tmpDir);
        expect((plugin.load as LoadHook)("/abs/path/foo.ts")).toBeUndefined();
    });

    it("rewrites a tracked asset import to a resource URI in build mode", async () => {
        const plugin = gtkxResources();
        await initPlugin(plugin, "build", tmpDir, "org.gtk.Demo4");

        const assetPath = join(tmpDir, "icons/foo.svg");
        const out = (plugin.load as LoadHook)(`${VIRTUAL_PREFIX}${assetPath}`) as string;

        expect(out).toContain('import { ensureRegistered } from "\\u0000gtkx-gresources-init";');
        expect(out).toContain("ensureRegistered();");
        expect(out).toContain(`export default "resource:///org/gtk/Demo4/icons/foo.svg";`);
        expect(out).toContain(`export const path = "/org/gtk/Demo4/icons/foo.svg";`);
    });

    it("nests a relative ?resource= override under the app prefix", async () => {
        const plugin = gtkxResources();
        await initPlugin(plugin, "build", tmpDir, "org.gtk.Demo4");

        const assetPath = join(tmpDir, "src/theme/dark.css");
        const virtualId = `${VIRTUAL_PREFIX}${assetPath}${OVERRIDE_SEPARATOR}style.css`;
        const out = (plugin.load as LoadHook)(virtualId) as string;

        expect(out).toContain(`export default "resource:///org/gtk/Demo4/style.css";`);
        expect(out).toContain(`export const path = "/org/gtk/Demo4/style.css";`);
    });

    it("treats a leading-slash ?resource= override as absolute, bypassing the prefix", async () => {
        const plugin = gtkxResources();
        await initPlugin(plugin, "build", tmpDir, "org.gtk.Demo4");

        const assetPath = join(tmpDir, "src/demos/css/brick.png");
        const virtualId = `${VIRTUAL_PREFIX}${assetPath}${OVERRIDE_SEPARATOR}/css_multiplebgs/brick.png`;
        const out = (plugin.load as LoadHook)(virtualId) as string;

        expect(out).toContain(`export default "resource:///css_multiplebgs/brick.png";`);
        expect(out).toContain(`export const path = "/css_multiplebgs/brick.png";`);
    });

    it("rejects assets outside the Vite root when no override is given", async () => {
        const root = join(tmpDir, "src");
        const plugin = gtkxResources();
        await initPlugin(plugin, "build", root);

        const outsidePath = join(tmpDir, "outside.png");
        expect(() => (plugin.load as LoadHook)(`${VIRTUAL_PREFIX}${outsidePath}`)).toThrow(/outside the Vite root/);
    });
});

describe("gtkxResources (buildEnd)", () => {
    setupTmpDir();

    it("is a no-op when no assets were imported", async () => {
        const plugin = gtkxResources();
        await initPlugin(plugin, "build", tmpDir);

        const emitFile = vi.fn();
        expect(() => (plugin.buildEnd as BuildEndHook).call({ emitFile })).not.toThrow();
        expect(emitFile).not.toHaveBeenCalled();
    });

    it("compiles tracked assets into a single .gresource and emits it", async () => {
        if (!hasGlibCompileResources()) return;

        const plugin = gtkxResources();
        await initPlugin(plugin, "build", tmpDir, "org.gtk.Demo4");

        const assetPath = join(tmpDir, "logo.png");
        writeFileSync(assetPath, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
        (plugin.load as LoadHook)(`${VIRTUAL_PREFIX}${assetPath}`);

        const emitFile = vi.fn();
        (plugin.buildEnd as BuildEndHook).call({ emitFile });

        expect(emitFile).toHaveBeenCalledTimes(1);
        const call = emitFile.mock.calls[0]?.[0];
        expect(call).toBeDefined();
        expect(call.type).toBe("asset");
        expect(call.fileName).toBe(BUNDLE_FILENAME);
        expect(Buffer.isBuffer(call.source)).toBe(true);
        expect(call.source.length).toBeGreaterThan(0);
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

const writeTinyPng = (path: string): void => {
    writeFileSync(path, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
};

describe("gtkxResources (watcher: change event)", () => {
    setupTmpDir();

    it("re-registers the GResource bundle when a tracked asset changes", async () => {
        if (!hasGlibCompileResources()) return;

        const plugin = gtkxResources();
        await initPlugin(plugin, "serve", tmpDir);

        const assetPath = join(tmpDir, "icon.png");
        writeTinyPng(assetPath);
        (plugin.load as LoadHook)(`${VIRTUAL_PREFIX}${assetPath}`);

        const refresh = vi.fn();
        const server = createFakeServer(refresh);
        (plugin.configureServer as ConfigureServerHook).call(plugin, server);

        server.watcher.emit("change", assetPath);
        await waitTicks();

        expect(server.ssrLoadModule).toHaveBeenCalledWith(VIRTUAL_INIT);
        expect(refresh).toHaveBeenCalled();
    });
});

describe("gtkxResources (watcher: add event)", () => {
    setupTmpDir();

    it("re-registers the bundle on the 'add' watcher event for a tracked asset", async () => {
        if (!hasGlibCompileResources()) return;

        const plugin = gtkxResources();
        await initPlugin(plugin, "serve", tmpDir);

        const assetPath = join(tmpDir, "addme.png");
        writeTinyPng(assetPath);
        (plugin.load as LoadHook)(`${VIRTUAL_PREFIX}${assetPath}`);

        const refresh = vi.fn();
        const server = createFakeServer(refresh);
        (plugin.configureServer as ConfigureServerHook).call(plugin, server);

        server.watcher.emit("add", assetPath);
        await waitTicks();

        expect(refresh).toHaveBeenCalled();
    });
});

describe("gtkxResources (watcher: untracked event)", () => {
    setupTmpDir();

    it("ignores file events for untracked paths", async () => {
        const plugin = gtkxResources();
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

describe("gtkxResources (watcher: refresh failure)", () => {
    setupTmpDir();

    it("logs and swallows refresh errors so the watcher keeps running", async () => {
        if (!hasGlibCompileResources()) return;

        const plugin = gtkxResources();
        await initPlugin(plugin, "serve", tmpDir);

        const assetPath = join(tmpDir, "broken.png");
        writeTinyPng(assetPath);
        (plugin.load as LoadHook)(`${VIRTUAL_PREFIX}${assetPath}`);

        const watcher = new EventEmitter();
        const server = {
            watcher,
            ssrLoadModule: vi.fn(async () => {
                throw new Error("ssr boom");
            }),
        };

        const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
        try {
            (plugin.configureServer as ConfigureServerHook).call(plugin, server);

            server.watcher.emit("change", assetPath);
            await waitTicks();

            expect(errSpy).toHaveBeenCalled();
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
