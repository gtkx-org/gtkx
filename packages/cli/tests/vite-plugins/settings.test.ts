import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BuildEndHook, ResolveIdHook } from "./plugin-hook-types.js";
import { gtkxSettings } from "../../src/vite-plugins/settings.js";
import { expectBuildEndEmitsAsset, expectBuildEndIsNoop } from "./build-end-assertions.js";
import { hasGlibCompileSchemas } from "./glib-tools.js";
import { callOutputOptions, expectComposedAsyncBanner, expectComposedBanner } from "./output-options.js";

type HandleHotUpdateHook = (this: unknown, ctx: { file: string; server: unknown }) => unknown;
type ConfigResolvedHook = (config: { command: "build" | "serve"; root?: string }) => void;

type LoadHook = (
    this: { error: (message: string) => never; emitFile: (asset: unknown) => string },
    id: string,
) => string | undefined | null;

type ConfigHook = (config: { root?: string }) => void;

type EnvPluginInit = {
    dataDir: string;
    plugin: ReturnType<typeof gtkxSettings>;
    envPath: string;
};

const stubLoadContext = () => ({
    error: (message: string): never => {
        throw new Error(message);
    },
    emitFile: vi.fn(),
});

const createPluginInMode = (command: "build" | "serve"): ReturnType<typeof gtkxSettings> => {
    const plugin = gtkxSettings();
    (plugin.configResolved as ConfigResolvedHook).call({}, { command });

    return plugin;
};

const callResolveIdSettings = async (
    resolve: (source: string) => Promise<{ id: string; external?: boolean } | null>,
    source: string,
): Promise<string | undefined | null> => {
    const plugin = gtkxSettings();

    return (plugin.resolveId as ResolveIdHook).call({ resolve }, source);
};

const firstSchemaDir = (): string => (process.env.GSETTINGS_SCHEMA_DIR ?? "").split(":", 1)[0] ?? "";

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

const setupDataDir = (tmp: string): string => {
    writeFileSync(join(tmp, "package.json"), JSON.stringify({ imports: { "#data/*": "./data/*" } }));
    const dataDir = join(tmp, "data");
    mkdirSync(dataDir, { recursive: true });

    return dataDir;
};

const initSchemaEnvPlugin = (tmp: string, seedSchemas?: (dataDir: string) => void): EnvPluginInit => {
    const dataDir = setupDataDir(tmp);
    seedSchemas?.(dataDir);
    const plugin = gtkxSettings();
    (plugin.config as ConfigHook).call(plugin, { root: tmp });
    (plugin.configResolved as ConfigResolvedHook).call({}, { command: "serve", root: tmp });
    const envPath = join(tmp, "node_modules", ".gtkx", "env.d.ts");

    return { dataDir, plugin, envPath };
};

const settingsVirtualId = (schemaPath: string): string => `\0gtkx-settings:${schemaPath}`;

const loadSchemaCode = (plugin: ReturnType<typeof gtkxSettings>, schemaPath: string): string =>
    (plugin.load as LoadHook).call(stubLoadContext(), settingsVirtualId(schemaPath)) as string;

const loadSchemaInServeMode = (schemaPath: string): { plugin: ReturnType<typeof gtkxSettings>; virtualId: string } => {
    const plugin = createPluginInMode("serve");
    loadSchemaCode(plugin, schemaPath);

    return { plugin, virtualId: settingsVirtualId(schemaPath) };
};

const loadSchemaDirInServeMode = (
    schemaPath: string,
): { plugin: ReturnType<typeof gtkxSettings>; schemaDir: string } => {
    const { plugin } = loadSchemaInServeMode(schemaPath);

    return { plugin, schemaDir: firstSchemaDir() };
};

class FakeEmitter {
    #listeners: Map<string, { listener: (...args: unknown[]) => void; isOnce: boolean }[]> = new Map();

    #register(event: string, listener: (...args: unknown[]) => void, isOnce: boolean): void {
        const entries = this.#listeners.get(event) ?? [];
        entries.push({ listener, isOnce });
        this.#listeners.set(event, entries);
    }

    on(event: string, listener: (...args: unknown[]) => void): void {
        this.#register(event, listener, false);
    }

    once(event: string, listener: (...args: unknown[]) => void): void {
        this.#register(event, listener, true);
    }

    emit(event: string, ...args: unknown[]): void {
        const entries = this.#listeners.get(event) ?? [];
        this.#listeners.set(event, entries.filter((entry) => !entry.isOnce));

        for (const entry of entries) {
            entry.listener(...args);
        }
    }
}

describe("gtkxSettings (plugin shape and init)", () => {
    it("returns a plugin with the expected name and pre-enforce", () => {
        const plugin = gtkxSettings();
        expect(plugin.name).toBe("gtkx:settings");
        expect(plugin.enforce).toBe("pre");
    });

    it("prepends the schema-env banner to build output options", () => {
        const plugin = createPluginInMode("build");
        const result = callOutputOptions(plugin, {});
        expect(result?.banner).toContain("GSETTINGS_SCHEMA_DIR");
        expect(result?.banner).toContain("import.meta.url");
    });

    it("leaves output options untouched outside build mode", () => {
        expect(callOutputOptions(createPluginInMode("serve"), {})).toBeUndefined();
    });

    it("composes a function banner by prepending the schema-env banner to its result", async () => {
        await expectComposedBanner(createPluginInMode("build"), "GSETTINGS_SCHEMA_DIR");
    });

    it("awaits an async original banner function", async () => {
        await expectComposedAsyncBanner(createPluginInMode("build"), "GSETTINGS_SCHEMA_DIR");
    });
});

describe("gtkxSettings (resolveId)", () => {
    it("resolveId ignores non-schema ids", async () => {
        const result = await callResolveIdSettings(() => Promise.resolve({ id: "" }), "./some.module.ts");
        expect(result).toBeUndefined();
    });

    it("resolveId returns null when the resolve hook reports external", async () => {
        const result = await callResolveIdSettings(
            () => Promise.resolve({ id: "/abs.gschema.xml", external: true }),
            "./x.gschema.xml",
        );

        expect(result).toBeUndefined();
    });

    it("resolveId returns the virtual prefix + resolved id for schema imports", async () => {
        const resolved = await callResolveIdSettings(
            () => Promise.resolve({ id: "/schema/path.gschema.xml" }),
            "./path.gschema.xml",
        );

        expect(resolved).toBe("\0gtkx-settings:/schema/path.gschema.xml");
    });
});

describe("gtkxSettings (load)", () => {
    it("load returns undefined for non-virtual ids", () => {
        const plugin = gtkxSettings();
        const result = (plugin.load as LoadHook).call(stubLoadContext(), "/regular/path/file.ts");
        expect(result).toBeUndefined();
    });

    it.skipIf(!hasGlibCompileSchemas())("load builds JS exports from a multi-schema file in build mode", () => {
        const tmp = mkdtempSync(join(tmpdir(), "gtkx-settings-test-"));
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
            const code = loadSchemaCode(createPluginInMode("build"), schemaPath);

            expect(code).toContain(
                "export const com_example_alpha = { id: \"com.example.alpha\", path: null, keys: keys_0 };",
            );

            expect(code).toContain("const keys_0 = { \"enabled\": \"b\" };");

            expect(code).toContain(
                "export const com_example_beta = { id: \"com.example.beta\", path: null, keys: keys_1 };",
            );

            expect(code).toContain("export default com_example_alpha;");
        } finally {
            rmSync(tmp, { recursive: true, force: true });
        }
    });
});

describe("gtkxSettings (load errors)", () => {
    it.skipIf(!hasGlibCompileSchemas())("load reports an error when the file has no schemas", () => {
        const tmp = mkdtempSync(join(tmpdir(), "gtkx-settings-no-schemas-"));
        const schemaPath = join(tmp, "empty.gschema.xml");
        writeFileSync(schemaPath, "<schemalist></schemalist>");

        try {
            const plugin = createPluginInMode("build");

            const errorMock = vi.fn<(message: string) => never>(() => {
                throw new Error("emitted");
            });

            expect(() =>
                (plugin.load as LoadHook).call(
                    { error: errorMock, emitFile: vi.fn() },
                    `\0gtkx-settings:${schemaPath}`,
                ),
            ).toThrow();

            expect(errorMock).toHaveBeenCalled();
        } finally {
            rmSync(tmp, { recursive: true, force: true });
        }
    });
});

describe("gtkxSettings (buildEnd)", () => {
    it("buildEnd is a no-op when no schemas were queued", () => {
        const plugin = createPluginInMode("build");
        expectBuildEndIsNoop(plugin.buildEnd as BuildEndHook);
    });

    it.skipIf(!hasGlibCompileSchemas())("buildEnd emits a compiled gschemas asset for queued schemas", () => {
        const tmp = mkdtempSync(join(tmpdir(), "gtkx-settings-buildend-"));
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
            const plugin = createPluginInMode("build");
            loadSchemaCode(plugin, schemaPath);
            expectBuildEndEmitsAsset(plugin.buildEnd as BuildEndHook, "gschemas.compiled");
        } finally {
            rmSync(tmp, { recursive: true, force: true });
        }
    });
});

describe("gtkxSettings (dev-mode load: fresh schema dir)", () => {
    setupSchemaDirEnv();

    it.skipIf(!hasGlibCompileSchemas())(
        "compiles a schema into a temp dir and prepends it to GSETTINGS_SCHEMA_DIR in serve mode",
        () => {
            const tmp = mkdtempSync(join(tmpdir(), "gtkx-settings-dev-"));
            const schemaPath = writeSchema(tmp, "dev.gschema.xml", "com.example.dev");

            try {
                const code = loadSchemaCode(createPluginInMode("serve"), schemaPath);

                expect(code).toContain(
                    "export const com_example_dev = { id: \"com.example.dev\", path: null, keys: keys_0 };",
                );

                expect(code).toContain("export default com_example_dev;");
                expect(code).not.toContain("gtkx-settings-init");
                expect(process.env.GSETTINGS_SCHEMA_DIR).toBeDefined();
                expect(firstSchemaDir()).toMatch(/gtkx-schemas-/);
            } finally {
                rmSync(tmp, { recursive: true, force: true });
            }
        },
    );
});

describe("gtkxSettings (dev-mode load: existing schema dir)", () => {
    setupSchemaDirEnv();

    it.skipIf(!hasGlibCompileSchemas())("appends to an existing GSETTINGS_SCHEMA_DIR when one is already set", () => {
        process.env.GSETTINGS_SCHEMA_DIR = "/existing/dir";
        const tmp = mkdtempSync(join(tmpdir(), "gtkx-settings-dev-existing-"));
        const schemaPath = writeSchema(tmp, "dev.gschema.xml", "com.example.dev2");

        try {
            loadSchemaInServeMode(schemaPath);
            expect(process.env.GSETTINGS_SCHEMA_DIR).toMatch(/^.*:\/existing\/dir$/);
        } finally {
            rmSync(tmp, { recursive: true, force: true });
        }
    });
});

describe("gtkxSettings (handleHotUpdate: untracked)", () => {
    it("ignores files that were never tracked", () => {
        const plugin = createPluginInMode("serve");

        const server = {
            moduleGraph: {
                getModuleById: vi.fn(),
                invalidateModule: vi.fn(),
            },
            watcher: new FakeEmitter(),
        };

        const result = (plugin.handleHotUpdate as HandleHotUpdateHook).call(plugin, {
            file: "/never-seen.gschema.xml",
            server,
        });

        expect(result).toBeUndefined();
        expect(server.moduleGraph.getModuleById).not.toHaveBeenCalled();
    });
});

describe("gtkxSettings (handleHotUpdate: tracked match)", () => {
    it.skipIf(!hasGlibCompileSchemas())(
        "recompiles the schema dir and invalidates the matching module when a tracked file changes",
        () => {
            const tmp = mkdtempSync(join(tmpdir(), "gtkx-settings-hmr-"));
            const schemaPath = writeSchema(tmp, "hmr.gschema.xml", "com.example.hmr");

            try {
                const { plugin, virtualId } = loadSchemaInServeMode(schemaPath);
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
                }) as { id: string }[];

                expect(server.moduleGraph.getModuleById).toHaveBeenCalledWith(virtualId);
                expect(server.moduleGraph.invalidateModule).toHaveBeenCalledWith(matchingModule);
                expect(result).toEqual([matchingModule]);
                expect(basename(schemaPath)).toBe("hmr.gschema.xml");
            } finally {
                rmSync(tmp, { recursive: true, force: true });
            }
        },
    );
});

describe("gtkxSettings (closeBundle)", () => {
    setupSchemaDirEnv();

    it.skipIf(!hasGlibCompileSchemas())("releases the dev-mode schema dir", () => {
        const tmp = mkdtempSync(join(tmpdir(), "gtkx-settings-close-"));
        const schemaPath = writeSchema(tmp, "close.gschema.xml", "com.example.close");

        try {
            const { plugin, schemaDir } = loadSchemaDirInServeMode(schemaPath);
            expect(existsSync(schemaDir)).toBe(true);
            (plugin.closeBundle as () => void).call(plugin);
            expect(existsSync(schemaDir)).toBe(false);
            (plugin.closeBundle as () => void).call(plugin);
        } finally {
            rmSync(tmp, { recursive: true, force: true });
        }
    });
});

describe("gtkxSettings (configureServer)", () => {
    setupSchemaDirEnv();

    it.skipIf(!hasGlibCompileSchemas())("releases the schema dir when the http server closes", () => {
        const tmp = mkdtempSync(join(tmpdir(), "gtkx-settings-server-"));
        const schemaPath = writeSchema(tmp, "srv.gschema.xml", "com.example.srv");

        try {
            const { plugin, schemaDir } = loadSchemaDirInServeMode(schemaPath);
            expect(existsSync(schemaDir)).toBe(true);
            const httpServer = new FakeEmitter();
            const watcher = new FakeEmitter();
            (plugin.configureServer as (server: unknown) => void).call(plugin, { httpServer, watcher });
            httpServer.emit("close");
            expect(existsSync(schemaDir)).toBe(false);
        } finally {
            rmSync(tmp, { recursive: true, force: true });
        }
    });
});

describe("gtkxSettings (schema env emission)", () => {
    it("emits the project env.d.ts from schemas under the #data import root", () => {
        const tmp = mkdtempSync(join(tmpdir(), "gtkx-settings-env-"));

        try {
            const { envPath } = initSchemaEnvPlugin(tmp, (dataDir) => {
                writeSchema(dataDir, "com.example.envtest.gschema.xml", "com.example.envtest");
            });

            expect(existsSync(envPath)).toBe(true);

            expect(readFileSync(envPath, "utf8")).toContain(
                "declare module \"#data/com.example.envtest.gschema.xml\" {",
            );
        } finally {
            rmSync(tmp, { recursive: true, force: true });
        }
    });

    it("refreshes the env.d.ts when the watcher reports schema file changes", () => {
        const tmp = mkdtempSync(join(tmpdir(), "gtkx-settings-env-watch-"));

        try {
            const { dataDir, plugin, envPath } = initSchemaEnvPlugin(tmp);
            expect(readFileSync(envPath, "utf8")).not.toContain("declare module");
            const schemaPath = writeSchema(dataDir, "com.example.added.gschema.xml", "com.example.added");
            const watcher = new FakeEmitter();
            (plugin.configureServer as (server: unknown) => void).call(plugin, { httpServer: null, watcher });
            watcher.emit("add", schemaPath);
            expect(readFileSync(envPath, "utf8")).toContain("declare module \"#data/com.example.added.gschema.xml\" {");
        } finally {
            rmSync(tmp, { recursive: true, force: true });
        }
    });
});

describe("gtkxSettings (handleHotUpdate: tracked orphan)", () => {
    it.skipIf(!hasGlibCompileSchemas())(
        "returns undefined when the tracked module is not present in the module graph",
        () => {
            const tmp = mkdtempSync(join(tmpdir(), "gtkx-settings-hmr-orphan-"));
            const schemaPath = writeSchema(tmp, "orphan.gschema.xml", "com.example.orphan");

            try {
                const { plugin } = loadSchemaInServeMode(schemaPath);

                const server = {
                    moduleGraph: {
                        getModuleById: vi.fn((): undefined => undefined),
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
        },
    );
});
