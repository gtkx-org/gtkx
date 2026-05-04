import type { DefaultValue, GirClass, GirProperty, GirRepository } from "@gtkx/gir";
import { describe, expect, it } from "vitest";
import { collectPropertiesWithDefaults, convertDefaultValue } from "../../../src/core/utils/default-value.js";

type FakeNamespace = {
    name: string;
    enumerations: Map<string, { name: string; members: Array<{ name: string; cIdentifier: string }> }>;
    bitfields: Map<string, { name: string; members: Array<{ name: string; cIdentifier: string }> }>;
};

function makeRepo(namespaces: FakeNamespace[]): GirRepository {
    const map = new Map<string, FakeNamespace>(namespaces.map((ns) => [ns.name, ns]));
    return {
        getAllNamespaces: () => map,
        resolveInterface: () => null,
    } as unknown as GirRepository;
}

function makeProperty(name: string, defaultValue: DefaultValue | null): GirProperty {
    return { name, defaultValue } as unknown as GirProperty;
}

function makeClass(properties: GirProperty[], implemented: string[] = []): GirClass {
    return {
        getAllProperties: () => properties,
        getAllImplementedInterfaces: () => implemented,
    } as unknown as GirClass;
}

describe("convertDefaultValue", () => {
    const repo = makeRepo([]);

    it("returns null when defaultValue is null", () => {
        expect(convertDefaultValue(null, repo, "Gtk")).toBeNull();
    });

    it("converts null kind to a null initializer with no imports", () => {
        expect(convertDefaultValue({ kind: "null" }, repo, "Gtk")).toEqual({ initializer: "null", imports: [] });
    });

    it("converts boolean true and false to lowercase TS literals", () => {
        expect(convertDefaultValue({ kind: "boolean", value: true }, repo, "Gtk")).toEqual({
            initializer: "true",
            imports: [],
        });
        expect(convertDefaultValue({ kind: "boolean", value: false }, repo, "Gtk")).toEqual({
            initializer: "false",
            imports: [],
        });
    });

    it("converts numbers via String() preserving sign and decimals", () => {
        expect(convertDefaultValue({ kind: "number", value: 0 }, repo, "Gtk")).toEqual({
            initializer: "0",
            imports: [],
        });
        expect(convertDefaultValue({ kind: "number", value: -3.14 }, repo, "Gtk")).toEqual({
            initializer: "-3.14",
            imports: [],
        });
    });

    it("JSON-encodes string defaults so quotes and backslashes are safe", () => {
        expect(convertDefaultValue({ kind: "string", value: 'hello "world"' }, repo, "Gtk")).toEqual({
            initializer: '"hello \\"world\\""',
            imports: [],
        });
    });

    it("returns null for unknown kinds", () => {
        expect(convertDefaultValue({ kind: "unknown", raw: "G_PRIORITY_DEFAULT" }, repo, "Gtk")).toBeNull();
    });

    it("returns null for an enum cIdentifier that is not in the repo", () => {
        expect(convertDefaultValue({ kind: "enum", cIdentifier: "GTK_NOPE" }, repo, "Gtk")).toBeNull();
    });

    it("resolves an enum from the same namespace without an import", () => {
        const enumRepo = makeRepo([
            {
                name: "Gtk",
                enumerations: new Map([
                    ["Align", { name: "align", members: [{ name: "fill", cIdentifier: "GTK_ALIGN_FILL" }] }],
                ]),
                bitfields: new Map(),
            },
        ]);

        expect(convertDefaultValue({ kind: "enum", cIdentifier: "GTK_ALIGN_FILL" }, enumRepo, "Gtk")).toEqual({
            initializer: "Align.FILL",
            imports: [],
        });
    });

    it("resolves an enum from a different namespace and emits a namespace-qualified import", () => {
        const enumRepo = makeRepo([
            {
                name: "Gtk",
                enumerations: new Map([
                    ["Align", { name: "align", members: [{ name: "fill", cIdentifier: "GTK_ALIGN_FILL" }] }],
                ]),
                bitfields: new Map(),
            },
        ]);

        expect(convertDefaultValue({ kind: "enum", cIdentifier: "GTK_ALIGN_FILL" }, enumRepo, "Adw")).toEqual({
            initializer: "Gtk.Align.FILL",
            imports: [{ name: "Align", namespace: "Gtk" }],
        });
    });

    it("falls back to bitfields when no matching enumeration is found", () => {
        const bitfieldRepo = makeRepo([
            {
                name: "Gtk",
                enumerations: new Map(),
                bitfields: new Map([
                    ["DebugFlags", { name: "debug-flags", members: [{ name: "text", cIdentifier: "GTK_DEBUG_TEXT" }] }],
                ]),
            },
        ]);

        expect(convertDefaultValue({ kind: "enum", cIdentifier: "GTK_DEBUG_TEXT" }, bitfieldRepo, "Gtk")).toEqual({
            initializer: "DebugFlags.TEXT",
            imports: [],
        });
    });
});

describe("collectPropertiesWithDefaults", () => {
    const emptyRepo = makeRepo([]);

    it("returns an empty map when the class has no properties with defaults", () => {
        const cls = makeClass([makeProperty("name", null)]);
        expect(collectPropertiesWithDefaults(cls, emptyRepo).size).toBe(0);
    });

    it("includes only properties that carry a default value", () => {
        const withDefault = makeProperty("orientation", { kind: "enum", cIdentifier: "GTK_ORIENTATION_HORIZONTAL" });
        const withoutDefault = makeProperty("name", null);
        const cls = makeClass([withDefault, withoutDefault]);

        const result = collectPropertiesWithDefaults(cls, emptyRepo);

        expect(result.size).toBe(1);
        expect(result.get("orientation")).toBe(withDefault);
    });

    it("merges defaults from implemented interfaces without overwriting class defaults", () => {
        const classProp = makeProperty("orientation", { kind: "boolean", value: true });
        const ifaceProp = makeProperty("orientation", { kind: "boolean", value: false });
        const interfaceOnlyProp = makeProperty("hexpand", { kind: "boolean", value: true });
        const cls = makeClass([classProp], ["Gtk.Orientable"]);

        const repo = {
            getAllNamespaces: () => new Map(),
            resolveInterface: (qn: string) =>
                qn === "Gtk.Orientable" ? ({ properties: [ifaceProp, interfaceOnlyProp] } as unknown) : null,
        } as unknown as GirRepository;

        const result = collectPropertiesWithDefaults(cls, repo);

        expect(result.get("orientation")).toBe(classProp);
        expect(result.get("hexpand")).toBe(interfaceOnlyProp);
    });

    it("ignores interface properties that lack a default value", () => {
        const ifaceProp = makeProperty("hexpand", null);
        const cls = makeClass([], ["Gtk.Orientable"]);

        const repo = {
            getAllNamespaces: () => new Map(),
            resolveInterface: () => ({ properties: [ifaceProp] }) as unknown,
        } as unknown as GirRepository;

        expect(collectPropertiesWithDefaults(cls, repo).size).toBe(0);
    });

    it("skips interfaces that the repository cannot resolve", () => {
        const cls = makeClass([], ["Missing.Interface"]);
        const repo = {
            getAllNamespaces: () => new Map(),
            resolveInterface: () => null,
        } as unknown as GirRepository;

        expect(collectPropertiesWithDefaults(cls, repo).size).toBe(0);
    });
});
