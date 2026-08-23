import { sortStringsBy, sourceStringLiteral, toCamelIdentifier } from "@gtkx/utils";
import type { GirClass } from "../../gir/class.js";
import type { GirEnum } from "../../gir/enum.js";
import type { Library } from "../../gir/library.js";
import type { PrimitiveCategory } from "../../gir/primitives.js";
import type { TypeId } from "../../gir/type-id.js";
import type { GirType } from "../../gir/type.js";
import { inputParameters } from "../../analysis/param-structure.js";
import { type GirProperty, isConstructableProperty } from "../../gir/property.js";
import {
    implementedInterfaces,
    isIntrinsicElementClass,
    iterateClassesWithGlibName,
    signalHandlerName,
} from "./intrinsic-elements.js";

type IntrinsicElementEntry = {
    glibName: string;
    signals: [string, string][];
    properties: [string, string][];
};

const READABLE = 1;
const WRITABLE = 2;
const CONSTRUCT = 4;
const CONSTRUCT_ONLY = 8;

const PROPERTY_ENTRY_TYPE =
    "/** The GObject name of a property, what a write may do to it, and the value it resets to. */\n" +
    "export type PropertyEntry = [name: string, flags: number, defaultValue?: unknown];";

const INTEGER_PATTERN = /^-?\d+$/;
const FLOAT_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;

const generateMetadata = (library: Library): string => {
    const intrinsicElements = collectIntrinsicElements(library);

    const signalsEntries = intrinsicElements.map(
        ({ glibName, signals }) => `    "${glibName}": ${renderSignalsObject(signals)},`,
    );

    const propertyEntries = intrinsicElements
        .filter(({ properties }) => properties.length > 0)
        .map(({ glibName, properties }) => `    "${glibName}": ${renderPropertiesObject(properties)},`);

    return `${[
        PROPERTY_ENTRY_TYPE,
        `export const signals: Record<string, Record<string, string>> = {\n${signalsEntries.join("\n")}\n};`,
        "export const properties: Record<string, Record<string, PropertyEntry>> = " +
        `{\n${propertyEntries.join("\n")}\n};`,
    ].join("\n\n")}\n`;
};

const collectIntrinsicElements = (library: Library): IntrinsicElementEntry[] => {
    const entries: IntrinsicElementEntry[] = [];
    const seen: Set<string> = new Set();

    for (const { glibName, klass, namespace } of iterateClassesWithGlibName(library)) {
        if (!isIntrinsicElementClass(klass, namespace, library) || seen.has(glibName)) {
            continue;
        }

        seen.add(glibName);

        const sources: GirClass[] = [
            klass,
            ...implementedInterfaces(klass, namespace, library).map((entry) => entry.klass),
        ];

        entries.push({
            glibName,
            signals: collectSignals(sources),
            properties: collectProperties(library, sources),
        });
    }

    return sortStringsBy(entries, (entry) => entry.glibName);
};

const collectSignalsFromSource = (source: GirClass, seen: Set<string>, signals: [string, string][]): void => {
    for (const signal of source.signals) {
        const handlerName = signalHandlerName(signal.name);

        if (seen.has(handlerName)) {
            continue;
        }

        seen.add(handlerName);
        signals.push([handlerName, signal.name] as const);
    }
};

const collectSignals = (sources: GirClass[]): [string, string][] => {
    const seen: Set<string> = new Set();
    const signals: [string, string][] = [];

    for (const source of sources) {
        collectSignalsFromSource(source, seen, signals);
    }

    return signals;
};

const propertyFlags = (property: GirProperty): number => {
    const construct = isConstructableProperty(property) && !property.constructOnly ? CONSTRUCT : 0;
    const constructOnly = property.constructOnly ? CONSTRUCT_ONLY : 0;

    return (property.readable ? READABLE : 0) |
        (property.writable ? WRITABLE : 0) |
        construct |
        constructOnly;
};

const propertyEntryLiteral = (library: Library, klass: GirClass, property: GirProperty): string => {
    const head = `${sourceStringLiteral(property.name)},${String(propertyFlags(property))}`;
    const literal = isDefaultCandidate(property) ? renderDefaultLiteral(library, klass, property) : undefined;

    return literal === undefined ? `[${head}]` : `[${head},${literal}]`;
};

const collectPropertiesFromSource = (
    library: Library,
    source: GirClass,
    seen: Set<string>,
    entries: [string, string][],
): void => {
    for (const property of source.properties) {
        const jsName = toCamelIdentifier(property.name);

        if (!property.introspectable || seen.has(jsName)) {
            continue;
        }

        seen.add(jsName);
        entries.push([jsName, propertyEntryLiteral(library, source, property)]);
    }
};

const collectProperties = (library: Library, sources: GirClass[]): [string, string][] => {
    const seen: Set<string> = new Set();
    const entries: [string, string][] = [];

    for (const source of sources) {
        collectPropertiesFromSource(library, source, seen, entries);
    }

    return entries;
};

const renderObjectLiteral = (entries: [string, string][], renderValue: (value: string) => string): string => {
    if (entries.length === 0) {
        return "{}";
    }

    const lines = entries.map(([key, value]) => `        ${sourceStringLiteral(key)}: ${renderValue(value)}`);

    return `{\n${lines.join(",\n")}\n    }`;
};

const renderPropertiesObject = (entries: [string, string][]): string =>
    renderObjectLiteral(entries, (value) => value);

const renderSignalsObject = (entries: [string, string][]): string => renderObjectLiteral(entries, sourceStringLiteral);

const isDefaultCandidate = (property: GirProperty): boolean =>
    (property.writable || property.construct) && !property.constructOnly && property.introspectable;

const willSetterRejectNull = (library: Library, klass: GirClass, property: GirProperty): boolean => {
    if (property.setter === undefined) {
        return false;
    }

    const setter = klass.methods.find((method) => method.name === property.setter);

    if (setter === undefined) {
        return false;
    }

    const [value] = inputParameters(library, setter);

    return value !== undefined && !value.parameter.nullable && !value.parameter.optional;
};

const setterValueRef = (library: Library, klass: GirClass, property: GirProperty): TypeId | undefined => {
    if (property.setter === undefined) {
        return undefined;
    }

    const setter = klass.methods.find((method) => method.name === property.setter);

    if (setter === undefined) {
        return undefined;
    }

    const [value] = inputParameters(library, setter);

    return value?.parameter.type;
};

const renderDefaultLiteral = (library: Library, klass: GirClass, property: GirProperty): string | undefined => {
    if (property.defaultValue === "NULL" && willSetterRejectNull(library, klass, property)) {
        return undefined;
    }

    const ref = setterValueRef(library, klass, property) ?? property.type;

    return resolveDefaultLiteral(library, ref, property.defaultValue);
};

const resolveDefaultLiteral = (
    library: Library,
    ref: TypeId | undefined,
    raw: string | undefined,
): string | undefined => {
    if (raw === undefined) {
        return undefined;
    }

    if (raw === "NULL") {
        return "null";
    }

    if (ref === undefined) {
        return undefined;
    }

    const resolved = library.typeFor(ref);

    if (resolved === undefined) {
        return undefined;
    }

    return resolveTypeDefaultLiteral(library, resolved, raw);
};

const resolveTypeDefaultLiteral = (library: Library, resolved: GirType, raw: string): string | undefined => {
    if (resolved.kind === "primitive") {
        return primitiveDefaultLiteral(resolved.category, raw);
    }

    if (resolved.kind === "enum") {
        return enumDefaultLiteral(resolved.value, raw);
    }

    if (resolved.kind === "alias") {
        return resolveDefaultLiteral(library, resolved.value.target, raw);
    }

    return undefined;
};

const booleanDefaultLiteral = (raw: string): string | undefined => {
    if (raw === "TRUE") {
        return "true";
    }

    if (raw === "FALSE") {
        return "false";
    }

    return undefined;
};

const integerDefaultLiteral = (raw: string): string | undefined => {
    const trimmed = raw.trim();

    return INTEGER_PATTERN.test(trimmed) ? trimmed : undefined;
};

const floatDefaultLiteral = (raw: string): string | undefined => {
    const trimmed = raw.trim();

    if (!FLOAT_PATTERN.test(trimmed)) {
        return undefined;
    }

    const value = Number(trimmed);

    return Number.isFinite(value) ? String(value) : undefined;
};

const primitiveDefaultLiteral = (category: PrimitiveCategory, raw: string): string | undefined => {
    switch (category) {
        case "boolean": {
            return booleanDefaultLiteral(raw);
        }
        case "int8":
        case "int16":
        case "int32":
        case "uint8":
        case "uint16":
        case "uint32":
        case "int64":
        case "uint64":
        case "unichar": {
            return integerDefaultLiteral(raw);
        }
        case "float32":
        case "float64": {
            return floatDefaultLiteral(raw);
        }
        case "string": {
            return sourceStringLiteral(raw);
        }
        case "bigint64":
        case "biguint64":
        case "gtype": {
            return bigintDefaultLiteral(raw);
        }
        case "pointer":
        case "void": {
            return undefined;
        }
    }
};

const bigintDefaultLiteral = (raw: string): string | undefined => {
    const integer = integerDefaultLiteral(raw);

    return integer === undefined ? undefined : `${integer}n`;
};

const enumDefaultLiteral = (enumType: GirEnum, raw: string): string | undefined => {
    const trimmed = raw.trim();

    if (INTEGER_PATTERN.test(trimmed)) {
        return trimmed;
    }

    const member = enumType.members.find((entry) => entry.cIdentifier === trimmed || entry.name === trimmed);

    return member?.value;
};

export { generateMetadata };
