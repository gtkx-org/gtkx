import { describe, expect, it } from "vitest";
import { parseSchemaXml, SchemaParseError } from "../../src/gsettings/parser.js";

const FILE = "test.gschema.xml";

describe("parseSchemaXml (schemas and keys)", () => {
    it("parses schema ids, paths, and typed keys with summaries", () => {
        const parsed = parseSchemaXml(
            `<?xml version="1.0"?>
<schemalist>
    <schema id="com.example.app" path="/com/example/app/">
        <key name="enabled" type="b">
            <default>false</default>
            <summary>Enabled flag</summary>
        </key>
        <key name="title" type="s">
            <default>"hi"</default>
        </key>
    </schema>
</schemalist>`,
            FILE,
        );

        expect(parsed.fileName).toBe(FILE);
        expect(parsed.schemas).toHaveLength(1);
        const schema = parsed.schemas[0];
        expect(schema?.id).toBe("com.example.app");
        expect(schema?.path).toBe("/com/example/app/");
        expect(schema?.keys).toEqual([
            {
                name: "enabled",
                variantType: "b",
                enumId: null,
                flagsId: null,
                choices: [],
                summary: "Enabled flag",
            },
            { name: "title", variantType: "s", enumId: null, flagsId: null, choices: [], summary: null },
        ]);
    });

    it("marks schemas without a path attribute as relocatable", () => {
        const parsed = parseSchemaXml(
            `<schemalist><schema id="com.example.profile"><key name="x" type="i"><default>0</default></key></schema></schemalist>`,
            FILE,
        );

        expect(parsed.schemas[0]?.path).toBeNull();
    });

    it("parses multiple schemas in document order", () => {
        const parsed = parseSchemaXml(
            `<schemalist>
                <schema id="com.example.a" path="/a/"/>
                <schema id="com.example.b" path="/b/"/>
            </schemalist>`,
            FILE,
        );

        expect(parsed.schemas.map((schema) => schema.id)).toEqual(["com.example.a", "com.example.b"]);
    });
});

describe("parseSchemaXml (enums, flags, choices)", () => {
    it("collects enum and flags definitions with their nicks", () => {
        const parsed = parseSchemaXml(
            `<schemalist>
                <enum id="com.example.Mode">
                    <value nick="auto" value="0"/>
                    <value nick="manual" value="1"/>
                </enum>
                <flags id="com.example.Sides">
                    <value nick="left" value="1"/>
                    <value nick="right" value="2"/>
                </flags>
                <schema id="com.example.app" path="/com/example/app/">
                    <key name="mode" enum="com.example.Mode"><default>'auto'</default></key>
                    <key name="sides" flags="com.example.Sides"><default>[]</default></key>
                </schema>
            </schemalist>`,
            FILE,
        );

        expect(parsed.enums.get("com.example.Mode")).toEqual(["auto", "manual"]);
        expect(parsed.flags.get("com.example.Sides")).toEqual(["left", "right"]);
        expect(parsed.schemas[0]?.keys[0]).toMatchObject({ name: "mode", enumId: "com.example.Mode" });
        expect(parsed.schemas[0]?.keys[1]).toMatchObject({ name: "sides", flagsId: "com.example.Sides" });
    });

    it("collects choice values on string keys", () => {
        const parsed = parseSchemaXml(
            `<schemalist>
                <schema id="com.example.app" path="/com/example/app/">
                    <key name="style" type="s">
                        <choices>
                            <choice value="light"/>
                            <choice value="dark"/>
                        </choices>
                        <default>'light'</default>
                    </key>
                </schema>
            </schemalist>`,
            FILE,
        );

        expect(parsed.schemas[0]?.keys[0]?.choices).toEqual(["light", "dark"]);
    });
});

describe("parseSchemaXml (extends)", () => {
    it("merges keys from extends chains declared in the same file", () => {
        const parsed = parseSchemaXml(
            `<schemalist>
                <schema id="com.example.base">
                    <key name="shared" type="s"><default>''</default></key>
                    <key name="overridden" type="i"><default>0</default></key>
                </schema>
                <schema id="com.example.child" extends="com.example.base">
                    <key name="overridden" type="d"><default>0.0</default></key>
                    <key name="own" type="b"><default>false</default></key>
                </schema>
            </schemalist>`,
            FILE,
        );

        const child = parsed.schemas[1];
        expect(child?.keys.map((key) => [key.name, key.variantType])).toEqual([
            ["shared", "s"],
            ["overridden", "d"],
            ["own", "b"],
        ]);
    });

    it("leaves keys unchanged when the extends parent lives in another file", () => {
        const parsed = parseSchemaXml(
            `<schemalist>
                <schema id="com.example.child" extends="com.example.elsewhere">
                    <key name="own" type="b"><default>false</default></key>
                </schema>
            </schemalist>`,
            FILE,
        );

        expect(parsed.schemas[0]?.keys.map((key) => key.name)).toEqual(["own"]);
    });
});

describe("parseSchemaXml (errors)", () => {
    it("throws when the file has no schemalist root", () => {
        expect(() => parseSchemaXml("<wrong/>", FILE)).toThrow(SchemaParseError);
        expect(() => parseSchemaXml("<wrong/>", FILE)).toThrow("test.gschema.xml has no <schemalist> root element");
    });

    it("throws when a schema has no id", () => {
        expect(() => parseSchemaXml(`<schemalist><schema path="/x/"/></schemalist>`, FILE)).toThrow(
            "A <schema> in test.gschema.xml has no id attribute",
        );
    });

    it("throws when a key has no name", () => {
        expect(() =>
            parseSchemaXml(
                `<schemalist><schema id="com.example.app"><key type="b"><default>false</default></key></schema></schemalist>`,
                FILE,
            ),
        ).toThrow("A <key> in test.gschema.xml has no name attribute");
    });

    it("wraps malformed XML in a SchemaParseError", () => {
        expect(() => parseSchemaXml("<schemalist><schema", FILE)).toThrow(SchemaParseError);
    });

    it("returns an empty schema list for a schemalist with no schemas", () => {
        expect(parseSchemaXml("<schemalist></schemalist>", FILE).schemas).toEqual([]);
    });
});
