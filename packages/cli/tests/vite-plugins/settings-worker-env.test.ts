import { resolveExecutable } from "@gtkx/utils";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { gtkxSettingsWorkerEnv } from "../../src/vite-plugins/settings-worker-env.js";

type ConfigHook = (config: { root?: string }) => { test?: { env?: Record<string, string> } } | undefined;

const hasGlibCompileSchemas = (): boolean => {
    try {
        execFileSync(resolveExecutable("glib-compile-schemas"), ["--version"], { stdio: ["ignore", "ignore", "ignore"] });
        return true;
    } catch {
        return false;
    }
};

const SCHEMA_XML = `<?xml version="1.0" encoding="UTF-8"?>
<schemalist>
  <schema id="com.example.worker" path="/com/example/worker/">
    <key name="filter" type="s">
      <default>'all'</default>
    </key>
  </schema>
</schemalist>
`;

const writeProject = (root: string, options: { dataDir: string | null; schema: boolean }): void => {
    const imports = options.dataDir === null ? {} : { imports: { "#data/*": `./${options.dataDir}/*` } };
    writeFileSync(join(root, "package.json"), JSON.stringify({ name: "worker-env-fixture", ...imports }));
    if (options.dataDir === null) return;
    const dataDir = join(root, options.dataDir);
    mkdirSync(dataDir, { recursive: true });
    if (options.schema) writeFileSync(join(dataDir, "com.example.worker.gschema.xml"), SCHEMA_XML);
};

const callConfig = (root: string): ReturnType<ConfigHook> => {
    const plugin = gtkxSettingsWorkerEnv();
    return (plugin.config as ConfigHook)({ root });
};

describe("gtkxSettingsWorkerEnv", () => {
    let root: string;
    let previousSchemaDir: string | undefined;
    let previousRunnerDir: string | undefined;

    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), "gtkx-worker-env-"));
        previousSchemaDir = process.env.GSETTINGS_SCHEMA_DIR;
        previousRunnerDir = process.env.GTKX_DEV_SCHEMA_DIR;
        delete process.env.GSETTINGS_SCHEMA_DIR;
        delete process.env.GTKX_DEV_SCHEMA_DIR;
    });

    afterEach(() => {
        rmSync(root, { recursive: true, force: true });
        if (previousSchemaDir === undefined) delete process.env.GSETTINGS_SCHEMA_DIR;
        else process.env.GSETTINGS_SCHEMA_DIR = previousSchemaDir;
        if (previousRunnerDir === undefined) delete process.env.GTKX_DEV_SCHEMA_DIR;
        else process.env.GTKX_DEV_SCHEMA_DIR = previousRunnerDir;
    });

    it("returns a plugin with the expected name and pre-enforce", () => {
        const plugin = gtkxSettingsWorkerEnv();
        expect(plugin.name).toBe("gtkx:settings-worker-env");
        expect(plugin.enforce).toBe("pre");
    });

    it.skipIf(!hasGlibCompileSchemas())(
        "compiles the project schemas before the workers start and points them at the result",
        () => {
            writeProject(root, { dataDir: "data", schema: true });

            const result = callConfig(root);
            const schemaDir = result?.test?.env?.GSETTINGS_SCHEMA_DIR;

            expect(schemaDir).toMatch(/gtkx-schemas-/);
            expect(existsSync(join(schemaDir ?? "", "gschemas.compiled"))).toBe(true);
            expect(process.env.GTKX_DEV_SCHEMA_DIR).toBe(schemaDir);
        },
    );

    it.skipIf(!hasGlibCompileSchemas())("prepends the compiled dir to an existing GSETTINGS_SCHEMA_DIR", () => {
        process.env.GSETTINGS_SCHEMA_DIR = "/existing/dir";
        writeProject(root, { dataDir: "data", schema: true });

        expect(callConfig(root)?.test?.env?.GSETTINGS_SCHEMA_DIR).toMatch(/^.*gtkx-schemas-.*:\/existing\/dir$/);
    });

    it.skipIf(!hasGlibCompileSchemas())("wraps compile failures for malformed schema XML", () => {
        writeProject(root, { dataDir: "data", schema: false });
        writeFileSync(join(root, "data", "com.example.broken.gschema.xml"), "<schemalist><schema id=");

        expect(() => callConfig(root)).toThrow(/glib-compile-schemas failed for /);
    });

    it("leaves the config untouched when the project declares no data directory", () => {
        writeProject(root, { dataDir: null, schema: false });

        expect(callConfig(root)).toBeUndefined();
        expect(process.env.GTKX_DEV_SCHEMA_DIR).toBeUndefined();
    });

    it("leaves the config untouched when the data directory holds no schemas", () => {
        writeProject(root, { dataDir: "data", schema: false });

        expect(callConfig(root)).toBeUndefined();
        expect(process.env.GTKX_DEV_SCHEMA_DIR).toBeUndefined();
    });
});
