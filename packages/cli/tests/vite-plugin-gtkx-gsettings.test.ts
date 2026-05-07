import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { gtkxGSettings } from "../src/vite-plugin-gtkx-gsettings.js";

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
) => string | undefined | null | Promise<string | undefined | null>;
type LoadHook = (
    this: { error: (message: string) => never; emitFile: (asset: unknown) => string },
    id: string,
) => string | undefined | null;
type BuildEndHook = (this: { emitFile: (asset: { type: string; fileName: string; source: Buffer }) => string }) => void;

const hasGlibCompileSchemas = (): boolean => {
    try {
        execFileSync("glib-compile-schemas", ["--version"], { stdio: ["ignore", "ignore", "ignore"] });
        return true;
    } catch {
        return false;
    }
};

describe("gtkxGSettings", () => {
    it("returns a plugin with the expected name and pre-enforce", () => {
        const plugin = gtkxGSettings();
        expect(plugin.name).toBe("gtkx:gsettings");
        expect(plugin.enforce).toBe("pre");
    });

    it("loads the virtual init module with bundleDir bootstrap code", () => {
        const plugin = gtkxGSettings();

        (plugin.configResolved as ConfigResolvedHook).call({}, { command: "build" });

        const result = (plugin.load as LoadHook).call(
            { error: (() => undefined) as unknown as (m: string) => never, emitFile: vi.fn() },
            "\0gtkx-gsettings-init",
        );

        expect(typeof result).toBe("string");
        expect(result).toContain("GSETTINGS_SCHEMA_DIR");
        expect(result).toContain("import.meta.url");
    });

    it("resolveId returns the virtual init id directly", async () => {
        const plugin = gtkxGSettings();
        const result = await (plugin.resolveId as ResolveIdHook).call(
            {
                resolve: () => Promise.resolve({ id: "" }),
            },
            "\0gtkx-gsettings-init",
        );
        expect(result).toBe("\0gtkx-gsettings-init");
    });

    it("resolveId ignores non-schema ids", async () => {
        const plugin = gtkxGSettings();
        const result = await (plugin.resolveId as ResolveIdHook).call(
            {
                resolve: () => Promise.resolve({ id: "" }),
            },
            "./some.module.ts",
        );
        expect(result).toBeUndefined();
    });

    it("resolveId returns null when the resolve hook reports external", async () => {
        const plugin = gtkxGSettings();
        const result = await (plugin.resolveId as ResolveIdHook).call(
            {
                resolve: () => Promise.resolve({ id: "/abs.gschema.xml", external: true }),
            },
            "./x.gschema.xml",
        );
        expect(result).toBeUndefined();
    });

    it("resolveId returns the virtual prefix + resolved id for schema imports", async () => {
        const plugin = gtkxGSettings();
        const resolved = await (plugin.resolveId as ResolveIdHook).call(
            {
                resolve: () => Promise.resolve({ id: "/schema/path.gschema.xml" }),
            },
            "./path.gschema.xml",
        );
        expect(resolved).toBe("\0gtkx-gsettings:/schema/path.gschema.xml");
    });

    it("load returns undefined for non-virtual ids", () => {
        const plugin = gtkxGSettings();
        const result = (plugin.load as LoadHook).call(
            { error: (() => undefined) as unknown as (m: string) => never, emitFile: vi.fn() },
            "/regular/path/file.ts",
        );
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

            const code = (plugin.load as LoadHook).call(
                {
                    error: (() => undefined) as unknown as (m: string) => never,
                    emitFile: vi.fn(),
                },
                `\0gtkx-gsettings:${schemaPath}`,
            ) as string;

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

    it("buildEnd is a no-op when no schemas were queued", () => {
        const plugin = gtkxGSettings();
        (plugin.configResolved as ConfigResolvedHook).call({}, { command: "build" });

        const emitFile = vi.fn();
        expect(() => (plugin.buildEnd as BuildEndHook).call({ emitFile })).not.toThrow();
        expect(emitFile).not.toHaveBeenCalled();
    });
});
