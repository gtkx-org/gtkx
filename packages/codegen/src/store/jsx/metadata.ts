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
    constructOnly: string[];
    constructable: string[];
    defaults: [string, string][];
};

type PropNameCollector = {
    keep: (property: GirProperty) => boolean;
    seen: Set<string>;
    names: string[];
};

type DefaultPropsCollector = {
    library: Library;
    seen: Set<string>;
    defaults: [string, string][];
};

const INTEGER_PATTERN = /^-?\d+$/;
const FLOAT_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;

const generateMetadata = (library: Library): string => {
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
    ].join("\n\n")}\n`;
};

const collectIntrinsicElements = (library: Library): IntrinsicElementEntry[] => {
    const entries: IntrinsicElementEntry[] = [];

    for (const { glibName, klass, namespace } of iterateClassesWithGlibName(library)) {
        if (!isIntrinsicElementClass(klass, namespace, library)) {
            continue;
        }

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

const collectPropNamesFromSource = (source: GirClass, collector: PropNameCollector): void => {
    const { keep, seen, names } = collector;

    for (const property of source.properties) {
        if (!keep(property)) {
            continue;
        }

        const jsName = toCamelIdentifier(property.name);

        if (seen.has(jsName)) {
            continue;
        }

        seen.add(jsName);
        names.push(jsName);
    }
};

const collectPropNames = (sources: GirClass[], shouldKeep: (property: GirProperty) => boolean): string[] => {
    const collector: PropNameCollector = { keep: shouldKeep, seen: new Set<string>(), names: [] };

    for (const source of sources) {
        collectPropNamesFromSource(source, collector);
    }

    return collector.names;
};

const collectConstructOnly = (sources: GirClass[]): string[] =>
    collectPropNames(sources, (property) => property.constructOnly && property.introspectable);

const collectConstructable = (sources: GirClass[]): string[] =>
    collectPropNames(sources, (property) => isConstructableProperty(property) && property.introspectable);

const renderObjectLiteral = (entries: [string, string][], renderValue: (value: string) => string): string => {
    if (entries.length === 0) {
        return "{}";
    }

    const lines = entries.map(([key, value]) => `        ${sourceStringLiteral(key)}: ${renderValue(value)}`);

    return `{\n${lines.join(",\n")}\n    }`;
};

const renderStringSet = (names: string[]): string =>
    `new Set([${names.map((name) => sourceStringLiteral(name)).join(",")}])`;

const renderSignalsObject = (entries: [string, string][]): string => renderObjectLiteral(entries, sourceStringLiteral);

const collectDefaultsFromClass = (klass: GirClass, collector: DefaultPropsCollector): void => {
    for (const property of klass.properties) {
        const entry = defaultPropEntry(collector.library, klass, property, collector.seen);

        if (entry !== undefined) {
            collector.defaults.push(entry);
        }
    }
};

const collectDefaultProps = (library: Library, sources: GirClass[]): [string, string][] => {
    const collector: DefaultPropsCollector = { library, seen: new Set<string>(), defaults: [] };

    for (const klass of sources) {
        collectDefaultsFromClass(klass, collector);
    }

    return collector.defaults;
};

const isDefaultCandidate = (property: GirProperty): boolean =>
    (property.writable || property.construct) && !property.constructOnly && property.introspectable;

const defaultPropEntry = (
    library: Library,
    klass: GirClass,
    property: GirProperty,
    seen: Set<string>,
): [string, string] | undefined => {
    if (!isDefaultCandidate(property)) {
        return undefined;
    }

    const jsName = toCamelIdentifier(property.name);

    if (seen.has(jsName)) {
        return undefined;
    }

    seen.add(jsName);
    const literal = renderDefaultLiteral(library, klass, property);

    if (literal === undefined) {
        return undefined;
    }

    return [jsName, literal];
};

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
    const trimmed = raw.trim();

    return INTEGER_PATTERN.test(trimmed) ? `${trimmed}n` : undefined;
};

const enumDefaultLiteral = (enumType: GirEnum, raw: string): string | undefined => {
    const trimmed = raw.trim();

    if (INTEGER_PATTERN.test(trimmed)) {
        return trimmed;
    }

    const member = enumType.members.find((entry) => entry.cIdentifier === trimmed || entry.name === trimmed);

    return member?.value;
};

const renderDefaultsObject = (entries: [string, string][]): string =>
    renderObjectLiteral(entries, (literal) => literal);

export { generateMetadata };
