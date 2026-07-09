import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emitSchemaEnv, findSchemaFiles, prependSchemaDir, schemaEnvPath } from "../../src/gsettings/schema.js";

const schemaXmlWithId = (id: string): string => `<schemalist>
    <schema id="${id}" path="/${id.replaceAll(".", "/")}/">
        <key name="enabled" type="b"><default>false</default></key>
    </schema>
</schemalist>`;

const SCHEMA_XML = schemaXmlWithId("com.example.app");

let root: string;

beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "gtkx-schema-env-"));
});

afterEach(() => {
    rmSync(root, { recursive: true, force: true });
});

const DATA_DIR = "data";

const writeDataSchema = (relPath: string, xml: string = SCHEMA_XML): void => {
    const full = join(root, DATA_DIR, relPath);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, xml);
};

describe("findSchemaFiles", () => {
    it("finds schema files recursively in sorted order", () => {
        mkdirSync(join(root, "schemas"), { recursive: true });
        writeFileSync(join(root, "b.gschema.xml"), SCHEMA_XML);
        writeFileSync(join(root, "schemas", "a.gschema.xml"), SCHEMA_XML);

        expect(findSchemaFiles(root)).toEqual([join(root, "b.gschema.xml"), join(root, "schemas", "a.gschema.xml")]);
    });

    it("ignores hidden directories", () => {
        mkdirSync(join(root, ".hidden"), { recursive: true });
        writeFileSync(join(root, ".hidden", "x.gschema.xml"), SCHEMA_XML);
        writeFileSync(join(root, "y.gschema.xml"), SCHEMA_XML);

        expect(findSchemaFiles(root)).toEqual([join(root, "y.gschema.xml")]);
    });

    it("returns an empty list for a directory that does not exist", () => {
        expect(findSchemaFiles(join(root, "missing"))).toEqual([]);
    });
});

describe("emitSchemaEnv", () => {
    it("writes the declaration file into node_modules/.gtkx", () => {
        writeDataSchema("com.example.app.gschema.xml");

        const result = emitSchemaEnv(root, DATA_DIR);

        expect(result.path).toBe(schemaEnvPath(root));
        expect(result.written).toBe(true);
        const content = readFileSync(result.path, "utf-8");
        expect(content).toContain(`declare module "#data/com.example.app.gschema.xml" {`);
        expect(content).toContain(`"enabled": boolean;`);
    });

    it("types a nested schema under its #data/<rel> specifier", () => {
        writeDataSchema(join("schemas", "com.example.app.gschema.xml"));

        const content = readFileSync(emitSchemaEnv(root, DATA_DIR).path, "utf-8");

        expect(content).toContain(`declare module "#data/schemas/com.example.app.gschema.xml" {`);
    });

    it("emits an empty declaration file when no data directory is configured", () => {
        writeDataSchema("com.example.app.gschema.xml");

        const content = readFileSync(emitSchemaEnv(root, null).path, "utf-8");

        expect(content).not.toContain("declare module");
    });

    it("ignores schemas outside the data directory", () => {
        writeFileSync(join(root, "com.example.outside.gschema.xml"), SCHEMA_XML);

        const result = emitSchemaEnv(root, DATA_DIR);

        expect(readFileSync(result.path, "utf-8")).not.toContain("declare module");
    });

    it("writes an empty declaration file for a project without schemas", () => {
        const result = emitSchemaEnv(root, DATA_DIR);

        expect(existsSync(result.path)).toBe(true);
        expect(readFileSync(result.path, "utf-8")).not.toContain("declare module");
    });

    it("leaves the file untouched when nothing changed", () => {
        writeDataSchema("com.example.app.gschema.xml");

        const first = emitSchemaEnv(root, DATA_DIR);
        const stamped = statSync(first.path).mtimeMs;
        const second = emitSchemaEnv(root, DATA_DIR);

        expect(first.written).toBe(true);
        expect(second.written).toBe(false);
        expect(statSync(second.path).mtimeMs).toBe(stamped);
    });

    it("types same-basename schemas in different subdirectories independently", () => {
        writeDataSchema(join("a", "settings.gschema.xml"), schemaXmlWithId("com.example.a"));
        writeDataSchema(join("b", "settings.gschema.xml"), schemaXmlWithId("com.example.b"));

        const content = readFileSync(emitSchemaEnv(root, DATA_DIR).path, "utf-8");

        expect(content).toContain(`declare module "#data/a/settings.gschema.xml" {`);
        expect(content).toContain(`declare module "#data/b/settings.gschema.xml" {`);
    });

    it("skips unparseable files with a warning and still writes the file", () => {
        const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
        try {
            writeDataSchema("broken.gschema.xml", "<not-a-schemalist/>");
            writeDataSchema("com.example.app.gschema.xml");

            const result = emitSchemaEnv(root, DATA_DIR);

            const warnings = stderr.mock.calls.map((call) => String(call[0])).filter((line) => line.includes("broken"));
            expect(warnings).toHaveLength(1);
            const content = readFileSync(result.path, "utf-8");
            expect(content).toContain("com.example.app.gschema.xml");
            expect(content).not.toContain("broken");
        } finally {
            stderr.mockRestore();
        }
    });
});

describe("prependSchemaDir", () => {
    it("returns the dir alone when there is no existing path", () => {
        expect(prependSchemaDir("/a", undefined)).toBe("/a");
        expect(prependSchemaDir("/a", "")).toBe("/a");
    });

    it("prepends the dir before an existing path", () => {
        expect(prependSchemaDir("/a", "/b:/c")).toBe("/a:/b:/c");
    });

    it("does not duplicate a dir already present in the path", () => {
        expect(prependSchemaDir("/b", "/a:/b:/c")).toBe("/a:/b:/c");
    });
});
