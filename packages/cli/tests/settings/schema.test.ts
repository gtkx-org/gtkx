import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emitSchemaEnv, findSchemaFiles, prependSchemaDir, schemaEnvPath } from "../../src/settings/schema.js";

const SCHEMA_XML = schemaXmlWithId("com.example.app");
const DATA_DIR = "data";
const fixture = { root: "" };

function schemaXmlWithId(id: string): string {
    return `<schemalist>
    <schema id="${id}" path="/${id.replaceAll(".", "/")}/">
        <key name="enabled" type="b"><default>false</default></key>
    </schema>
</schemalist>`;
}

const writeDataSchema = (relPath: string, xml: string = SCHEMA_XML): void => {
    const full = join(fixture.root, DATA_DIR, relPath);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, xml);
};

beforeEach(() => {
    fixture.root = mkdtempSync(join(tmpdir(), "gtkx-schema-env-"));
});

afterEach(() => {
    rmSync(fixture.root, { recursive: true, force: true });
});

describe("findSchemaFiles", () => {
    it("finds schema files recursively in sorted order", () => {
        mkdirSync(join(fixture.root, "schemas"), { recursive: true });
        writeFileSync(join(fixture.root, "b.gschema.xml"), SCHEMA_XML);
        writeFileSync(join(fixture.root, "schemas", "a.gschema.xml"), SCHEMA_XML);

        expect(findSchemaFiles(fixture.root)).toEqual([
            join(fixture.root, "b.gschema.xml"),
            join(fixture.root, "schemas", "a.gschema.xml"),
        ]);
    });

    it("ignores hidden directories", () => {
        mkdirSync(join(fixture.root, ".hidden"), { recursive: true });
        writeFileSync(join(fixture.root, ".hidden", "x.gschema.xml"), SCHEMA_XML);
        writeFileSync(join(fixture.root, "y.gschema.xml"), SCHEMA_XML);
        expect(findSchemaFiles(fixture.root)).toEqual([join(fixture.root, "y.gschema.xml")]);
    });

    it("returns an empty list for a directory that does not exist", () => {
        expect(findSchemaFiles(join(fixture.root, "missing"))).toEqual([]);
    });
});

describe("emitSchemaEnv", () => {
    it("writes the declaration file into node_modules/.gtkx", () => {
        writeDataSchema("com.example.app.gschema.xml");
        const result = emitSchemaEnv(fixture.root, DATA_DIR);
        expect(result.path).toBe(schemaEnvPath(fixture.root));
        expect(result.isWritten).toBe(true);
        const content = readFileSync(result.path, "utf8");
        expect(content).toContain("declare module \"#data/com.example.app.gschema.xml\" {");
        expect(content).toContain("\"enabled\": \"b\";");
    });

    it("types a nested schema under its #data/<rel> specifier", () => {
        writeDataSchema(join("schemas", "com.example.app.gschema.xml"));
        const content = readFileSync(emitSchemaEnv(fixture.root, DATA_DIR).path, "utf8");
        expect(content).toContain("declare module \"#data/schemas/com.example.app.gschema.xml\" {");
    });

    it("emits an empty declaration file when no data directory is configured", () => {
        writeDataSchema("com.example.app.gschema.xml");
        const content = readFileSync(emitSchemaEnv(fixture.root, null).path, "utf8");
        expect(content).not.toContain("declare module");
    });

    it("ignores schemas outside the data directory", () => {
        writeFileSync(join(fixture.root, "com.example.outside.gschema.xml"), SCHEMA_XML);
        const result = emitSchemaEnv(fixture.root, DATA_DIR);
        expect(readFileSync(result.path, "utf8")).not.toContain("declare module");
    });

    it("writes an empty declaration file for a project without schemas", () => {
        const result = emitSchemaEnv(fixture.root, DATA_DIR);
        expect(existsSync(result.path)).toBe(true);
        expect(readFileSync(result.path, "utf8")).not.toContain("declare module");
    });
});

describe("emitSchemaEnv (incremental writes and diagnostics)", () => {
    it("leaves the file untouched when nothing changed", () => {
        writeDataSchema("com.example.app.gschema.xml");
        const first = emitSchemaEnv(fixture.root, DATA_DIR);
        const stamped = statSync(first.path).mtimeMs;
        const second = emitSchemaEnv(fixture.root, DATA_DIR);
        expect(first.isWritten).toBe(true);
        expect(second.isWritten).toBe(false);
        expect(statSync(second.path).mtimeMs).toBe(stamped);
    });

    it("types same-basename schemas in different subdirectories independently", () => {
        writeDataSchema(join("a", "settings.gschema.xml"), schemaXmlWithId("com.example.a"));
        writeDataSchema(join("b", "settings.gschema.xml"), schemaXmlWithId("com.example.b"));
        const content = readFileSync(emitSchemaEnv(fixture.root, DATA_DIR).path, "utf8");
        expect(content).toContain("declare module \"#data/a/settings.gschema.xml\" {");
        expect(content).toContain("declare module \"#data/b/settings.gschema.xml\" {");
    });

    it("skips unparseable files with a warning and still writes the file", () => {
        const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

        try {
            writeDataSchema("broken.gschema.xml", "<not-a-schemalist/>");
            writeDataSchema("com.example.app.gschema.xml");
            const result = emitSchemaEnv(fixture.root, DATA_DIR);
            const warnings = stderr.mock.calls.map((call) => String(call[0])).filter((line) => line.includes("broken"));
            expect(warnings).toHaveLength(1);
            const content = readFileSync(result.path, "utf8");
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
