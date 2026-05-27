import { execFileSync } from "node:child_process";
import { EventEmitter } from "node:events";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { gtkxGSettings } from "../../src/vite-plugins/gsettings.js";
import type { BuildEndHook, ResolveIdHook } from "./plugin-hook-types.js";

type HandleHotUpdateHook = (this: unknown, ctx: { file: string; server: unknown }) => unknown;

type ConfigResolvedHook = (config: { command: "build" | "serve" }) => void;
type LoadHook = (
    this: { error: (message: string) => never; emitFile: (asset: unknown) => string },
    id: string,
) => string | undefined | null;

const hasGlibCompileSchemas = (): boolean => {
    try {
        execFileSync("glib-compile-schemas", ["--version"], { stdio: ["ignore", "ignore", "ignore"] });
        return true;
    } catch {
        return false;
    }
};

const stubLoadContext = () => ({
    error: (() => undefined) as unknown as (m: string) => never,
    emitFile: vi.fn(),
});

const callResolveIdGsettings = async (
    resolve: (source: string) => Promise<{ id: string; external?: boolean } | null>,
    source: string,
): Promise<string | undefined | null> => {
    const plugin = gtkxGSettings();
    return (plugin.resolveId as ResolveIdHook).call({ resolve }, source);
};

describe("gtkxGSettings (plugin shape and init)", () => {
    it("returns a plugin with the expected name and pre-enforce", () => {
        const plugin = gtkxGSettings();
        expect(plugin.name).toBe("gtkx:gsettings");
        expect(plugin.enforce).toBe("pre");
    });

    it("loads the virtual init module with bundleDir bootstrap code", () => {
        const plugin = gtkxGSettings();
        (plugin.configResolved as ConfigResolvedHook).call({}, { command: "build" });
        const result = (plugin.load as LoadHook).call(stubLoadContext(), "\0gtkx-gsettings-init");
        expect(typeof result).toBe("string");
        expect(result).toContain("GSETTINGS_SCHEMA_DIR");
        expect(result).toContain("import.meta.url");
    });
});

describe("gtkxGSettings (resolveId)", () => {
    it("resolveId returns the virtual init id directly", async () => {
        const result = await callResolveIdGsettings(() => Promise.resolve({ id: "" }), "\0gtkx-gsettings-init");
        expect(result).toBe("\0gtkx-gsettings-init");
    });

    it("resolveId ignores non-schema ids", async () => {
        const result = await callResolveIdGsettings(() => Promise.resolve({ id: "" }), "./some.module.ts");
        expect(result).toBeUndefined();
    });

    it("resolveId returns null when the resolve hook reports external", async () => {
        const result = await callResolveIdGsettings(
            () => Promise.resolve({ id: "/abs.gschema.xml", external: true }),
            "./x.gschema.xml",
        );
        expect(result).toBeUndefined();
    });

    it("resolveId returns the virtual prefix + resolved id for schema imports", async () => {
        const resolved = await callResolveIdGsettings(
            () => Promise.resolve({ id: "/schema/path.gschema.xml" }),
            "./path.gschema.xml",
        );
        expect(resolved).toBe("\0gtkx-gsettings:/schema/path.gschema.xml");
    });
});

describe("gtkxGSettings (load)", () => {
    it("load returns undefined for non-virtual ids", () => {
        const plugin = gtkxGSettings();
        const result = (plugin.load as LoadHook).call(stubLoadContext(), "/regular/path/file.ts");
        expect(result).toBeUndefined();
    });

    it("load builds JS exports from a multi-schema file in build mode", () => {
        if (!hasGlibCompileSchemas()) return;

        const tmp = mkdtempSync(join(tmpdir(), "gtkx-gsettings-test-"));
        const schemaPath = join(tmp, "test.gschema.xml");
        writeFileSync(
            schemaPath,
            `<?xml version="1.0"?>
<schemalist>
    <schema id="com.example.alpha" path="/com/example/alpha/">
        <key name="enabled" type="b"><default>false</default></key>
    </schema>
    <schema id="com.example.beta" path="/com/example/beta/">
        <key name="count" type="i"><default>0</default></key>
    </schema>
</schemalist>`,
        );

        try {
            const plugin = gtkxGSettings();
            (plugin.configResolved as ConfigResolvedHook).call({}, { command: "build" });

            const code = (plugin.load as LoadHook).call(stubLoadContext(), `\0gtkx-gsettings:${schemaPath}`) as string;

            expect(code).toContain(`export default "com.example.alpha";`);
            expect(code).toContain(`export const com_example_alpha = "com.example.alpha";`);
            expect(code).toContain(`export const com_example_beta = "com.example.beta";`);
            expect(code).toContain(`import "\\u0000gtkx-gsettings-init";`);
        } finally {
            rmSync(tmp, { recursive: true, force: true });
        }
    });

    it("load reports an error when the file has no schemas", () => {
        if (!hasGlibCompileSchemas()) return;

        const tmp = mkdtempSync(join(tmpdir(), "gtkx-gsettings-no-schemas-"));
        const schemaPath = join(tmp, "empty.gschema.xml");
        writeFileSync(schemaPath, `<schemalist></schemalist>`);

        try {
            const plugin = gtkxGSettings();
            (plugin.configResolved as ConfigResolvedHook).call({}, { command: "build" });

            const errorMock = vi.fn(() => {
                throw new Error("emitted");
            });

            expect(() =>
                (plugin.load as LoadHook).call(
                    { error: errorMock as unknown as (m: string) => never, emitFile: vi.fn() },
                    `\0gtkx-gsettings:${schemaPath}`,
                ),
            ).toThrow();
            expect(errorMock).toHaveBeenCalled();
        } finally {
            rmSync(tmp, { recursive: true, force: true });
        }
    });
});

describe("gtkxGSettings (buildEnd)", () => {
    it("buildEnd is a no-op when no schemas were queued", () => {
        const plugin = gtkxGSettings();
        (plugin.configResolved as ConfigResolvedHook).call({}, { command: "build" });

        const emitFile = vi.fn();
        expect(() => (plugin.buildEnd as BuildEndHook).call({ emitFile })).not.toThrow();
        expect(emitFile).not.toHaveBeenCalled();
    });

    it("buildEnd emits a compiled gschemas asset for queued schemas", () => {
        if (!hasGlibCompileSchemas()) return;

        const tmp = mkdtempSync(join(tmpdir(), "gtkx-gsettings-buildend-"));
        const schemaPath = join(tmp, "build.gschema.xml");
        writeFileSync(
            schemaPath,
            `<?xml version="1.0"?>
<schemalist>
    <schema id="com.example.build" path="/com/example/build/">
        <key name="x" type="b"><default>false</default></key>
    </schema>
</schemalist>`,
        );

        try {
            const plugin = gtkxGSettings();
            (plugin.configResolved as ConfigResolvedHook).call({}, { command: "build" });
            (plugin.load as LoadHook).call(stubLoadContext(), `\0gtkx-gsettings:${schemaPath}`);

            const emitFile = vi.fn();
            (plugin.buildEnd as BuildEndHook).call({ emitFile });

            expect(emitFile).toHaveBeenCalledTimes(1);
            const call = emitFile.mock.calls[0]?.[0];
            expect(call?.type).toBe("asset");
            expect(call?.fileName).toBe("gschemas.compiled");
            expect(Buffer.isBuffer(call?.source)).toBe(true);
            expect((call?.source as Buffer).length).toBeGreaterThan(0);
        } finally {
            rmSync(tmp, { recursive: true, force: true });
        }
    });
});

const setupSchemaDirEnv = (): void => {
    let prevSchemaDir: string | undefined;
    beforeEach(() => {
        prevSchemaDir = process.env.GSETTINGS_SCHEMA_DIR;
        delete process.env.GSETTINGS_SCHEMA_DIR;
    });
    afterEach(() => {
        if (prevSchemaDir === undefined) {
            delete process.env.GSETTINGS_SCHEMA_DIR;
        } else {
            process.env.GSETTINGS_SCHEMA_DIR = prevSchemaDir;
        }
    });
};

const writeSchema = (tmp: string, fileName: string, schemaId: string): string => {
    const schemaPath = join(tmp, fileName);
    writeFileSync(
        schemaPath,
        `<?xml version="1.0"?>
<schemalist>
    <schema id="${schemaId}" path="/${schemaId.replaceAll(".", "/")}/">
        <key name="x" type="b"><default>false</default></key>
    </schema>
</schemalist>`,
    );
    return schemaPath;
};

describe("gtkxGSettings (dev-mode load: fresh schema dir)", () => {
    setupSchemaDirEnv();

    it("compiles a schema into a temp dir and prepends it to GSETTINGS_SCHEMA_DIR in serve mode", () => {
        if (!hasGlibCompileSchemas()) return;

        const tmp = mkdtempSync(join(tmpdir(), "gtkx-gsettings-dev-"));
        const schemaPath = writeSchema(tmp, "dev.gschema.xml", "com.example.dev");

        try {
            const plugin = gtkxGSettings();
            (plugin.configResolved as ConfigResolvedHook).call({}, { command: "serve" });

            const code = (plugin.load as LoadHook).call(stubLoadContext(), `\0gtkx-gsettings:${schemaPath}`) as string;
            expect(code).toContain(`export default "com.example.dev";`);
            expect(code).not.toContain("gtkx-gsettings-init");

            expect(process.env.GSETTINGS_SCHEMA_DIR).toBeDefined();
            const first = process.env.GSETTINGS_SCHEMA_DIR?.split(":")[0];
            expect(first).toMatch(/gtkx-schemas-/);
        } finally {
            rmSync(tmp, { recursive: true, force: true });
        }
    });
});

describe("gtkxGSettings (dev-mode load: existing schema dir)", () => {
    setupSchemaDirEnv();

    it("appends to an existing GSETTINGS_SCHEMA_DIR when one is already set", () => {
        if (!hasGlibCompileSchemas()) return;

        process.env.GSETTINGS_SCHEMA_DIR = "/existing/dir";
        const tmp = mkdtempSync(join(tmpdir(), "gtkx-gsettings-dev-existing-"));
        const schemaPath = writeSchema(tmp, "dev.gschema.xml", "com.example.dev2");

        try {
            const plugin = gtkxGSettings();
            (plugin.configResolved as ConfigResolvedHook).call({}, { command: "serve" });
            (plugin.load as LoadHook).call(stubLoadContext(), `\0gtkx-gsettings:${schemaPath}`);

            expect(process.env.GSETTINGS_SCHEMA_DIR).toMatch(/^.*:\/existing\/dir$/);
        } finally {
            rmSync(tmp, { recursive: true, force: true });
        }
    });
});

describe("gtkxGSettings (handleHotUpdate: untracked)", () => {
    it("ignores files that were never tracked", () => {
        const plugin = gtkxGSettings();
        (plugin.configResolved as ConfigResolvedHook).call({}, { command: "serve" });

        const server = {
            moduleGraph: {
                getModuleById: vi.fn(),
                invalidateModule: vi.fn(),
            },
            watcher: new EventEmitter(),
        };
        const result = (plugin.handleHotUpdate as HandleHotUpdateHook).call(plugin, {
            file: "/never-seen.gschema.xml",
            server,
        });
        expect(result).toBeUndefined();
        expect(server.moduleGraph.getModuleById).not.toHaveBeenCalled();
    });
});

describe("gtkxGSettings (handleHotUpdate: tracked match)", () => {
    it("recompiles the schema dir and invalidates the matching module when a tracked file changes", () => {
        if (!hasGlibCompileSchemas()) return;

        const tmp = mkdtempSync(join(tmpdir(), "gtkx-gsettings-hmr-"));
        const schemaPath = writeSchema(tmp, "hmr.gschema.xml", "com.example.hmr");

        try {
            const plugin = gtkxGSettings();
            (plugin.configResolved as ConfigResolvedHook).call({}, { command: "serve" });

            const virtualId = `\0gtkx-gsettings:${schemaPath}`;
            (plugin.load as LoadHook).call(stubLoadContext(), virtualId);

            const matchingModule = { id: virtualId };
            const server = {
                moduleGraph: {
                    getModuleById: vi.fn((id: string) => (id === virtualId ? matchingModule : undefined)),
                    invalidateModule: vi.fn(),
                },
            };

            const result = (plugin.handleHotUpdate as HandleHotUpdateHook).call(plugin, {
                file: schemaPath,
                server,
            }) as Array<{ id: string }>;

            expect(server.moduleGraph.getModuleById).toHaveBeenCalledWith(virtualId);
            expect(server.moduleGraph.invalidateModule).toHaveBeenCalledWith(matchingModule);
            expect(result).toEqual([matchingModule]);
            expect(basename(schemaPath)).toBe("hmr.gschema.xml");
        } finally {
            rmSync(tmp, { recursive: true, force: true });
        }
    });
});

describe("gtkxGSettings (closeBundle)", () => {
    setupSchemaDirEnv();

    it("releases the dev-mode schema dir", () => {
        if (!hasGlibCompileSchemas()) return;

        const tmp = mkdtempSync(join(tmpdir(), "gtkx-gsettings-close-"));
        const schemaPath = writeSchema(tmp, "close.gschema.xml", "com.example.close");

        try {
            const plugin = gtkxGSettings();
            (plugin.configResolved as ConfigResolvedHook).call({}, { command: "serve" });
            (plugin.load as LoadHook).call(stubLoadContext(), `\0gtkx-gsettings:${schemaPath}`);

            const schemaDir = process.env.GSETTINGS_SCHEMA_DIR?.split(":")[0] ?? "";
            expect(existsSync(schemaDir)).toBe(true);

            (plugin.closeBundle as () => void).call(plugin);

            expect(existsSync(schemaDir)).toBe(false);
            (plugin.closeBundle as () => void).call(plugin);
        } finally {
            rmSync(tmp, { recursive: true, force: true });
        }
    });
});

describe("gtkxGSettings (configureServer)", () => {
    setupSchemaDirEnv();

    it("releases the schema dir when the http server closes", () => {
        if (!hasGlibCompileSchemas()) return;

        const tmp = mkdtempSync(join(tmpdir(), "gtkx-gsettings-server-"));
        const schemaPath = writeSchema(tmp, "srv.gschema.xml", "com.example.srv");

        try {
            const plugin = gtkxGSettings();
            (plugin.configResolved as ConfigResolvedHook).call({}, { command: "serve" });
            (plugin.load as LoadHook).call(stubLoadContext(), `\0gtkx-gsettings:${schemaPath}`);

            const schemaDir = process.env.GSETTINGS_SCHEMA_DIR?.split(":")[0] ?? "";
            expect(existsSync(schemaDir)).toBe(true);

            const httpServer = new EventEmitter();
            const watcher = new EventEmitter();
            (plugin.configureServer as (server: unknown) => void).call(plugin, { httpServer, watcher });

            httpServer.emit("close");
            expect(existsSync(schemaDir)).toBe(false);
        } finally {
            rmSync(tmp, { recursive: true, force: true });
        }
    });
});

describe("gtkxGSettings (handleHotUpdate: tracked orphan)", () => {
    it("returns undefined when the tracked module is not present in the module graph", () => {
        if (!hasGlibCompileSchemas()) return;

        const tmp = mkdtempSync(join(tmpdir(), "gtkx-gsettings-hmr-orphan-"));
        const schemaPath = writeSchema(tmp, "orphan.gschema.xml", "com.example.orphan");

        try {
            const plugin = gtkxGSettings();
            (plugin.configResolved as ConfigResolvedHook).call({}, { command: "serve" });

            const virtualId = `\0gtkx-gsettings:${schemaPath}`;
            (plugin.load as LoadHook).call(stubLoadContext(), virtualId);

            const server = {
                moduleGraph: {
                    getModuleById: vi.fn(() => undefined),
                    invalidateModule: vi.fn(),
                },
            };

            const result = (plugin.handleHotUpdate as HandleHotUpdateHook).call(plugin, {
                file: schemaPath,
                server,
            });

            expect(result).toBeUndefined();
            expect(server.moduleGraph.invalidateModule).not.toHaveBeenCalled();
        } finally {
            rmSync(tmp, { recursive: true, force: true });
        }
    });
});
