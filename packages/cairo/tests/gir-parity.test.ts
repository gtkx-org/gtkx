import * as cairo from "@gtkx/cairo";
import { XMLParser } from "fast-xml-parser";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

type GirType = { "@_name": string };
type GirMember = { "@_name": string; "@_value": string };
type GirEnumeration = { "@_name": string; member: GirMember[] };
type GirField = { "@_name": string; type: GirType };
type GirRecord = { "@_name": string; field?: GirField[] };
type GirNamespace = { enumeration: GirEnumeration[]; record: GirRecord[] };
type GirRepository = { repository: { namespace: GirNamespace } };
type StructClass = new (props?: Record<string, unknown>) => Record<string, unknown>;
type EnumValues = Record<string, number>;

const GIR_PATH = join(dirname(fileURLToPath(import.meta.url)), "..", "gir", "cairo-1.0.gir");
const ARRAY_TAGS = new Set(["enumeration", "member", "record", "field"]);
const BIGINT_TYPES = new Set(["gulong", "glong", "guint64", "gint64"]);
const exports: Record<string, unknown> = { ...cairo };
const namespace = parseGir();
const fieldRecords = namespace.record.filter((record) => record.field !== undefined);
const opaqueRecords = namespace.record.filter((record) => record.field === undefined);

function parseGir(): GirNamespace {
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        isArray: (name) => ARRAY_TAGS.has(name),
    });

    return (parser.parse(readFileSync(GIR_PATH, "utf8")) as GirRepository).repository.namespace;
}

const memberName = (member: GirMember): string => member["@_name"].toUpperCase().replaceAll("-", "_");
const camelCase = (name: string): string => name.replaceAll(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());

const sampleValue = (field: GirField, position: number): number | bigint =>
    BIGINT_TYPES.has(field.type["@_name"]) ? BigInt(position + 1) : position + 1;

const girMembers = (enumeration: GirEnumeration): EnumValues =>
    Object.fromEntries(enumeration.member.map((member) => [memberName(member), Number(member["@_value"])]));

const sortedEntries = (values: EnumValues): [string, number][] =>
    Object.entries(values).toSorted(([left], [right]) => left.localeCompare(right));

describe("@gtkx/cairo against the vendored cairo-1.0.gir", () => {
    it.each(namespace.enumeration.map((enumeration) => [enumeration["@_name"], enumeration]))(
        "exports the %s enum with the GIR members and values",
        (name, enumeration) => {
            const exported = exports[name];
            expect(exported).toBeTypeOf("object");
            expect(sortedEntries(exported as EnumValues)).toEqual(sortedEntries(girMembers(enumeration)));
        },
    );

    it.each(fieldRecords.map((record) => [record["@_name"], record]))(
        "exports the %s struct and round-trips each field through its accessor",
        (name, record) => {
            const exported = exports[name] as StructClass;
            const fields = record.field ?? [];

            const props = Object.fromEntries(
                fields.map((field, position) => [camelCase(field["@_name"]), sampleValue(field, position)]),
            );

            const instance = new exported(props);
            expect(instance).toBeInstanceOf(exported);

            for (const [key, value] of Object.entries(props)) {
                expect(instance[key]).toBe(value);
            }
        },
    );

    it.each(opaqueRecords.map((record) => [record["@_name"]]))("exports the opaque %s record as a class", (name) => {
        expect(exports[name]).toBeTypeOf("function");
    });

    it("leaves the fields of a struct constructed without props at zero", () => {
        const rect = new cairo.RectangleInt();
        expect([rect.x, rect.y, rect.width, rect.height]).toEqual([0, 0, 0, 0]);
        expect(new cairo.Glyph().index).toBe(0n);
    });

    it("writes back through the setters", () => {
        const rect = new cairo.Rectangle({ x: 1.5 });
        rect.width = 2.5;
        expect(rect.x).toBe(1.5);
        expect(rect.width).toBe(2.5);
    });

    it("throws when a struct field receives a non-numeric value", () => {
        expect(() => new cairo.RectangleInt({ x: "wide" as never })).toThrow();
        expect(() => new cairo.Glyph({ index: "first" as never })).toThrow();
    });
});
