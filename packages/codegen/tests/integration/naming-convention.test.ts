import { describe, expect, it } from "vitest";
import {
    collectIntrinsicElementClasses,
    glibNameOf,
    implementedInterfaces,
    interfaceHasPropsBody,
} from "../../src/store/react/intrinsic-elements.js";
import { generateJsxFiles } from "../../src/store/react/pipeline.js";
import { ACCESSIBLE_ATTRIBUTES } from "../../src/store/react/tables.js";
import { giModules, library } from "../helpers/library.js";

const jsxSources = (): string[] => generateJsxFiles(library).namespaces.map((entry) => entry.source);

const interfacePropsNames = (): Set<string> => {
    const names = new Set<string>();
    for (const widget of collectIntrinsicElementClasses(library)) {
        for (const iface of implementedInterfaces(widget.klass, widget.namespace, library)) {
            if (!interfaceHasPropsBody(iface.klass)) continue;
            const glib = glibNameOf(iface.klass);
            if (glib !== undefined) names.add(`${glib}Props`);
        }
    }
    return names;
};

const ENUM_NAME_BY_KIND: Record<"property" | "state" | "relation", string> = {
    property: "AccessibleProperty",
    state: "AccessibleState",
    relation: "AccessibleRelation",
};

const screamingEnumMembers = (enumName: string): Set<string> => {
    const resolved = library.resolveType("Gtk", enumName);
    expect(resolved?.kind, `expected Gtk.${enumName} enum`).toBe("enum");
    const names = new Set<string>();
    if (resolved?.kind !== "enum") return names;
    for (const member of resolved.value.members) names.add(member.name.toUpperCase().replaceAll("-", "_"));
    return names;
};

const matchAll = (sources: string[], pattern: RegExp): string[] =>
    sources.flatMap((source) => [...source.matchAll(pattern)].map((match) => match[1] ?? ""));

const moduleSource = (directory: string): string => {
    const found = giModules.find((entry) => entry.directory === directory);
    expect(found, `expected generated module for ${directory}`).toBeDefined();
    return found?.source ?? "";
};

describe("identifier naming convention", () => {
    it("exports aliases under their GIR name, never the C-prefixed c:type", () => {
        const glib = moduleSource("glib");
        expect(glib).toMatch(/export type Quark\b/);
        expect(glib).toMatch(/export type Pid\b/);
        expect(glib).not.toMatch(/\bGQuark\b/);
        expect(glib).not.toMatch(/\bGPid\b/);
    });

    it("publishes the GObject Type alias under its GIR name", () => {
        const gobject = moduleSource("gobject");
        expect(gobject).toMatch(/export type Type\b/);
        expect(gobject).not.toMatch(/export type GType\b/);
    });

    it("emits a named type for every top-level callback, under its GIR name", () => {
        const glib = moduleSource("glib");
        expect(glib).toContain("export type SourceFunc =");
        expect(glib).toContain("export type CompareFunc =");
    });

    it("exports the shadowed short name for a shadowing namespace function", () => {
        const glib = moduleSource("glib");
        expect(glib).toMatch(/\bidleAdd\b/);
        expect(glib).not.toMatch(/\bidleAddFull\b/);
    });

    it("emits record, union, and enum identifiers verbatim from the GIR name", () => {
        const harfbuzz = moduleSource("harfbuzz");
        expect(harfbuzz).toMatch(/export class font_t\b/);
        expect(harfbuzz).toMatch(/export enum memory_mode_t\b/);
        expect(harfbuzz).not.toMatch(/export class FontT\b/);
        expect(harfbuzz).not.toMatch(/export enum MemoryModeT\b/);
    });
});

describe("jsx prop-interface naming convention", () => {
    it("names every exported props interface after an element or implemented interface glib name", () => {
        const sources = jsxSources();
        const declaredProps = matchAll(sources, /export interface (\w+Props)\b/g);
        const elementGlibNames = matchAll(sources, /^\s*(\w+): \w+Props;$/gm);
        const allowed = new Set([...elementGlibNames.map((name) => `${name}Props`), ...interfacePropsNames()]);

        const offenders = declaredProps.filter((name) => !allowed.has(name));
        expect(offenders, `unexpected props interface names: ${offenders.join(", ")}`).toEqual([]);
    });
});

describe("accessible attribute table", () => {
    it("maps every accessible attribute to a GTK accessible enum member matching its kind", () => {
        const membersByEnum = new Map<string, Set<string>>();
        const offenders: string[] = [];
        for (const [name, attribute] of Object.entries(ACCESSIBLE_ATTRIBUTES)) {
            const enumName = ENUM_NAME_BY_KIND[attribute.kind];
            const members = membersByEnum.get(enumName) ?? screamingEnumMembers(enumName);
            membersByEnum.set(enumName, members);
            if (!members.has(attribute.member)) offenders.push(`${name} (${attribute.kind}.${attribute.member})`);
        }
        expect(offenders, `accessible attributes without a matching enum member: ${offenders.join(", ")}`).toEqual([]);
    });
});
