import type { ElementProp } from "@gtkx/config";
import { sortStringsBy, sourceStringLiteral, toCamelIdentifier } from "@gtkx/utils";
import type { GirClass } from "../../gir/class.js";
import type { GirEnum } from "../../gir/enum.js";
import type { Library } from "../../gir/library.js";
import type { PrimitiveCategory } from "../../gir/primitives.js";
import { type GirProperty, isConstructableProperty } from "../../gir/property.js";
import type { TypeId } from "../../gir/type-id.js";
import {
    implementedInterfaces,
    isIntrinsicElementClass,
    iterateClassesWithGlibName,
    signalHandlerName,
} from "./intrinsic-elements.js";

export const generateMetadata = (library: Library, elementProps: Record<string, ElementProp[]>): string => {
    const intrinsicElements = collectIntrinsicElements(library);
    const signalsEntries = intrinsicElements.map(
        ({ glibName, signals }) => `    "${glibName}": ${renderSignalsObject(signals)},`,
    );
    const constructOnlyEntries = intrinsicElements
        .filter(({ constructOnly }) => constructOnly.length > 0)
        .map(({ glibName, constructOnly }) => `    "${glibName}": ${renderStringSet(constructOnly)},`);
    const constructableEntries = intrinsicElements
        .filter(({ constructable }) => constructable.length > 0)
        .map(({ glibName, constructable }) => `    "${glibName}": ${renderStringSet(constructable)},`);
    const defaultsEntries = intrinsicElements
        .filter(({ defaults }) => defaults.length > 0)
        .map(({ glibName, defaults }) => `    "${glibName}": ${renderDefaultsObject(defaults)},`);

    return `${[
        `export const SIGNALS: Record<string, Record<string, string>> = {\n${signalsEntries.join("\n")}\n};`,
        `export const CONSTRUCT_ONLY_PROPS: Record<string, Set<string>> = {\n${constructOnlyEntries.join("\n")}\n};`,
        `export const CONSTRUCT_PROPS: Record<string, Set<string>> = {\n${constructableEntries.join("\n")}\n};`,
        `export const DEFAULT_PROPS: Record<string, Record<string, unknown>> = {\n${defaultsEntries.join("\n")}\n};`,
        `export const ELEMENT_PROPS: Record<string, Array<import("@gtkx/react").ElementProp>> = ${JSON.stringify(elementProps, null, 4)};`,
    ].join("\n\n")}\n`;
};

type IntrinsicElementEntry = {
    glibName: string;
    signals: [string, string][];
    constructOnly: string[];
    constructable: string[];
    defaults: [string, string][];
};

const collectIntrinsicElements = (library: Library): IntrinsicElementEntry[] => {
    const entries: IntrinsicElementEntry[] = [];
    for (const { glibName, klass, namespace } of iterateClassesWithGlibName(library)) {
        if (!isIntrinsicElementClass(klass, namespace, library)) continue;
        const sources: GirClass[] = [
            klass,
            ...implementedInterfaces(klass, namespace, library).map((entry) => entry.klass),
        ];
        entries.push({
            glibName,
            signals: collectSignals(sources),
            constructOnly: collectConstructOnly(sources),
            constructable: collectConstructable(sources),
            defaults: collectDefaultProps(library, sources),
        });
    }
    return sortStringsBy(entries, (entry) => entry.glibName);
};

const collectSignals = (sources: GirClass[]): [string, string][] => {
    const seen = new Set<string>();
    const signals: [string, string][] = [];
    for (const source of sources) {
        for (const signal of source.signals) {
            const handlerName = signalHandlerName(signal.name);
            if (seen.has(handlerName)) continue;
            seen.add(handlerName);
            signals.push([handlerName, signal.name] as const);
        }
    }
    return signals;
};

const collectPropNames = (sources: GirClass[], keep: (property: GirProperty) => boolean): string[] => {
    const seen = new Set<string>();
    const names: string[] = [];
    for (const source of sources) {
        for (const property of source.properties) {
            if (!keep(property)) continue;
            const jsName = toCamelIdentifier(property.name);
            if (seen.has(jsName)) continue;
            seen.add(jsName);
            names.push(jsName);
        }
    }
    return names;
};

const collectConstructOnly = (sources: GirClass[]): string[] =>
    collectPropNames(sources, (property) => property.constructOnly && property.introspectable);

const collectConstructable = (sources: GirClass[]): string[] => collectPropNames(sources, isConstructableProperty);

const renderObjectLiteral = (entries: [string, string][], renderValue: (value: string) => string): string => {
    if (entries.length === 0) return "{}";
    const lines = entries.map(([key, value]) => `        ${sourceStringLiteral(key)}: ${renderValue(value)}`);
    return `{\n${lines.join(",\n")}\n    }`;
};

const renderStringSet = (names: string[]): string => `new Set([${names.map(sourceStringLiteral).join(",")}])`;

const renderSignalsObject = (entries: [string, string][]): string => renderObjectLiteral(entries, sourceStringLiteral);

const collectDefaultProps = (library: Library, sources: GirClass[]): [string, string][] => {
    const seen = new Set<string>();
    const defaults: [string, string][] = [];
    for (const klass of sources) {
        for (const property of klass.properties) {
            const settable = (property.writable || property.construct) && !property.constructOnly;
            if (!settable || !property.introspectable) continue;
            const jsName = toCamelIdentifier(property.name);
            if (seen.has(jsName)) continue;
            seen.add(jsName);
            const literal = renderDefaultLiteral(library, property);
            if (literal === undefined) continue;
            defaults.push([jsName, literal] as const);
        }
    }
    return defaults;
};

const renderDefaultLiteral = (library: Library, property: GirProperty): string | undefined =>
    resolveDefaultLiteral(library, property.type, property.defaultValue);

const resolveDefaultLiteral = (
    library: Library,
    ref: TypeId | undefined,
    raw: string | undefined,
): string | undefined => {
    if (raw === undefined) return undefined;
    if (raw === "NULL") return "null";
    if (ref === undefined) return undefined;
    const resolved = library.typeOf(ref);
    if (resolved === undefined) return undefined;
    if (resolved.kind === "primitive") return primitiveDefaultLiteral(resolved.category, raw);
    if (resolved.kind === "enum") return enumDefaultLiteral(resolved.value, raw);
    if (resolved.kind === "alias") return resolveDefaultLiteral(library, resolved.value.target, raw);
    return undefined;
};

const INTEGER_PATTERN = /^-?\d+$/;

const primitiveDefaultLiteral = (category: PrimitiveCategory, raw: string): string | undefined => {
    switch (category) {
        case "boolean":
            if (raw === "TRUE") return "true";
            if (raw === "FALSE") return "false";
            return undefined;
        case "int8":
        case "int16":
        case "int32":
        case "uint8":
        case "uint16":
        case "uint32":
        case "int64":
        case "uint64":
        case "unichar":
            return INTEGER_PATTERN.test(raw.trim()) ? raw.trim() : undefined;
        case "float32":
        case "float64": {
            const value = Number.parseFloat(raw);
            return Number.isFinite(value) ? String(value) : undefined;
        }
        case "string":
            return sourceStringLiteral(raw);
        default:
            return undefined;
    }
};

const enumDefaultLiteral = (enumType: GirEnum, raw: string): string | undefined => {
    const trimmed = raw.trim();
    if (INTEGER_PATTERN.test(trimmed)) return trimmed;
    const member = enumType.members.find((entry) => entry.cIdentifier === trimmed || entry.name === trimmed);
    return member?.value;
};

const renderDefaultsObject = (entries: [string, string][]): string =>
    renderObjectLiteral(entries, (literal) => literal);
