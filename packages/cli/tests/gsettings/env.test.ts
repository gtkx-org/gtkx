import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emitSchemaEnv, findSchemaFiles, schemaEnvPath } from "../../src/gsettings/env.js";

const SCHEMA_XML = `<schemalist>
    <schema id="com.example.app" path="/com/example/app/">
        <key name="enabled" type="b"><default>false</default></key>
    </schema>
</schemalist>`;

let root: string;

beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "gtkx-schema-env-"));
});

afterEach(() => {
    rmSync(root, { recursive: true, force: true });
});

describe("findSchemaFiles", () => {
    it("finds schema files recursively in sorted order", () => {
        mkdirSync(join(root, "schemas"), { recursive: true });
        writeFileSync(join(root, "b.gschema.xml"), SCHEMA_XML);
        writeFileSync(join(root, "schemas", "a.gschema.xml"), SCHEMA_XML);

        expect(findSchemaFiles(root)).toEqual([join(root, "b.gschema.xml"), join(root, "schemas", "a.gschema.xml")]);
    });

    it("skips node_modules, build output, and hidden directories", () => {
        for (const dir of ["node_modules", "dist", "out-tsc", "coverage", ".hidden"]) {
            mkdirSync(join(root, dir), { recursive: true });
            writeFileSync(join(root, dir, "x.gschema.xml"), SCHEMA_XML);
        }

        expect(findSchemaFiles(root)).toEqual([]);
    });
});

describe("emitSchemaEnv", () => {
    it("writes the declaration file into node_modules/.gtkx", () => {
        writeFileSync(join(root, "com.example.app.gschema.xml"), SCHEMA_XML);

        const result = emitSchemaEnv(root);

        expect(result.path).toBe(schemaEnvPath(root));
        expect(result.written).toBe(true);
        const content = readFileSync(result.path, "utf-8");
        expect(content).toContain(`declare module "*/com.example.app.gschema.xml" {`);
        expect(content).toContain(`"enabled": boolean;`);
    });

    it("writes an empty declaration file for a project without schemas", () => {
        const result = emitSchemaEnv(root);

        expect(existsSync(result.path)).toBe(true);
        expect(readFileSync(result.path, "utf-8")).not.toContain("declare module");
    });

    it("leaves the file untouched when nothing changed", () => {
        writeFileSync(join(root, "com.example.app.gschema.xml"), SCHEMA_XML);

        const first = emitSchemaEnv(root);
        const stamped = statSync(first.path).mtimeMs;
        const second = emitSchemaEnv(root);

        expect(first.written).toBe(true);
        expect(second.written).toBe(false);
        expect(statSync(second.path).mtimeMs).toBe(stamped);
    });

    it("throws when two schema files share a basename", () => {
        mkdirSync(join(root, "nested"), { recursive: true });
        writeFileSync(join(root, "com.example.app.gschema.xml"), SCHEMA_XML);
        writeFileSync(join(root, "nested", "com.example.app.gschema.xml"), SCHEMA_XML);

        expect(() => emitSchemaEnv(root)).toThrow('Duplicate GSettings schema file name "com.example.app.gschema.xml"');
    });

    it("skips unparseable files with a warning and still writes the file", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        try {
            writeFileSync(join(root, "broken.gschema.xml"), "<not-a-schemalist/>");
            writeFileSync(join(root, "com.example.app.gschema.xml"), SCHEMA_XML);

            const result = emitSchemaEnv(root);

            expect(warn).toHaveBeenCalledOnce();
            const content = readFileSync(result.path, "utf-8");
            expect(content).toContain("com.example.app.gschema.xml");
            expect(content).not.toContain("broken");
        } finally {
            warn.mockRestore();
        }
    });
});
