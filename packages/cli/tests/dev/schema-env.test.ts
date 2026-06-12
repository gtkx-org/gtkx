import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prepareDevSchemaEnv } from "../../src/dev/schema-env.js";

const SCHEMA_XML = `<?xml version="1.0" encoding="UTF-8"?>
<schemalist>
    <schema id="com.example.schemaenv" path="/com/example/schemaenv/">
        <key name="enabled" type="b">
            <default>true</default>
        </key>
    </schema>
</schemalist>
`;

describe("prepareDevSchemaEnv", () => {
    let projectDir: string;
    let savedSchemaDir: string | undefined;
    let savedDevSchemaDir: string | undefined;

    beforeEach(() => {
        projectDir = mkdtempSync(join(tmpdir(), "gtkx-schema-env-test-"));
        savedSchemaDir = process.env.GSETTINGS_SCHEMA_DIR;
        savedDevSchemaDir = process.env.GTKX_DEV_SCHEMA_DIR;
        delete process.env.GSETTINGS_SCHEMA_DIR;
        delete process.env.GTKX_DEV_SCHEMA_DIR;
    });

    afterEach(() => {
        rmSync(projectDir, { recursive: true, force: true });
        if (savedSchemaDir === undefined) delete process.env.GSETTINGS_SCHEMA_DIR;
        else process.env.GSETTINGS_SCHEMA_DIR = savedSchemaDir;
        if (savedDevSchemaDir === undefined) delete process.env.GTKX_DEV_SCHEMA_DIR;
        else process.env.GTKX_DEV_SCHEMA_DIR = savedDevSchemaDir;
    });

    it("returns null and leaves the environment alone without schemas", () => {
        const dir = prepareDevSchemaEnv(projectDir);

        expect(dir).toBeNull();
        expect(process.env.GSETTINGS_SCHEMA_DIR).toBeUndefined();
        expect(process.env.GTKX_DEV_SCHEMA_DIR).toBeUndefined();
    });

    it("compiles project schemas and exports the directory before GTK loads", () => {
        writeFileSync(join(projectDir, "com.example.schemaenv.gschema.xml"), SCHEMA_XML);

        const dir = prepareDevSchemaEnv(projectDir);

        expect(dir).not.toBeNull();
        expect(existsSync(join(dir ?? "", "gschemas.compiled"))).toBe(true);
        expect(process.env.GTKX_DEV_SCHEMA_DIR).toBe(dir);
        expect(process.env.GSETTINGS_SCHEMA_DIR).toBe(dir);
    });

    it("prepends to an existing GSETTINGS_SCHEMA_DIR", () => {
        writeFileSync(join(projectDir, "com.example.schemaenv.gschema.xml"), SCHEMA_XML);
        process.env.GSETTINGS_SCHEMA_DIR = "/usr/share/glib-2.0/schemas";

        const dir = prepareDevSchemaEnv(projectDir);

        expect(process.env.GSETTINGS_SCHEMA_DIR).toBe(`${dir}:/usr/share/glib-2.0/schemas`);
    });

    it("skips node_modules, dist, and hidden directories", () => {
        for (const name of ["node_modules", "dist", ".cache"]) {
            mkdirSync(join(projectDir, name), { recursive: true });
            writeFileSync(join(projectDir, name, "com.example.skipped.gschema.xml"), SCHEMA_XML);
        }

        const dir = prepareDevSchemaEnv(projectDir);

        expect(dir).toBeNull();
    });
});
