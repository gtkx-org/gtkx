import type {
    AddMethodRule,
    ArrayPropRow,
    AttachShapeTable,
    ContainerPropRow,
    ElementMapRule,
    ObjectPropRow,
    PageMetaSetter,
    PerElementPropRows,
    PropRule,
    VirtualPropRow,
} from "@gtkx/config";
import { quote, sortedAlphaBy, toCamelIdentifier } from "@gtkx/utils";
import type { GirClass } from "../gir/class.js";
import type { GirEnum } from "../gir/enum.js";
import type { PrimitiveCategory } from "../gir/primitives.js";
import { type GirProperty, isConstructableProperty } from "../gir/property.js";
import type { GirRepository } from "../gir/repository.js";
import type { TypeId } from "../gir/type-id.js";
import { implementedInterfaces, isReactNodeClass, iterateClassesWithGlibName, signalHandlerName } from "./widgets.js";

export type RuntimeTables = {
    elementMap: ElementMapRule[];
    arrayProps: PerElementPropRows<ArrayPropRow>;
    objectProps: PerElementPropRows<ObjectPropRow>;
    virtualProps: PerElementPropRows<VirtualPropRow>;
    propRules: Record<string, PropRule[]>;
    topLevelTypes: string[];
    defaultBlockableTypes: string[];
    metaObjectAddMethods: Record<string, AddMethodRule[]>;
    pageMetaSetters: PageMetaSetter[];
    containerProps: PerElementPropRows<ContainerPropRow>;
    attachShapes: AttachShapeTable;
};

const configType = (name: string): string => `import("@gtkx/config").${name}`;

const nestedRecordOf = (rowType: string): string => `Record<string, Record<string, ${configType(rowType)}>>`;

const recordOfArray = (rowType: string): string => `Record<string, Array<${configType(rowType)}>>`;

const arrayOf = (rowType: string): string => `Array<${configType(rowType)}>`;

type RuntimeTableSpec = {
    name: string;
    annotation: string;
};

const RUNTIME_TABLE_SPECS: Record<keyof RuntimeTables, RuntimeTableSpec> = {
    elementMap: { name: "ELEMENT_MAP", annotation: arrayOf("ElementMapRule") },
    arrayProps: { name: "ARRAY_PROPS", annotation: nestedRecordOf("ArrayPropRow") },
    objectProps: { name: "OBJECT_PROPS", annotation: nestedRecordOf("ObjectPropRow") },
    virtualProps: { name: "VIRTUAL_PROPS", annotation: nestedRecordOf("VirtualPropRow") },
    propRules: { name: "PROP_RULES", annotation: recordOfArray("PropRule") },
    topLevelTypes: { name: "TOP_LEVEL_TYPES", annotation: "string[]" },
    defaultBlockableTypes: { name: "DEFAULT_BLOCKABLE_TYPES", annotation: "string[]" },
    metaObjectAddMethods: { name: "META_OBJECT_ADD_METHODS", annotation: recordOfArray("AddMethodRule") },
    pageMetaSetters: { name: "PAGE_META_SETTERS", annotation: arrayOf("PageMetaSetter") },
    containerProps: { name: "CONTAINER_PROPS", annotation: nestedRecordOf("ContainerPropRow") },
    attachShapes: { name: "ATTACH_SHAPES", annotation: recordOfArray("AttachShape") },
};

const RUNTIME_TABLE_KEYS = Object.keys(RUNTIME_TABLE_SPECS) as Array<keyof RuntimeTables>;

const renderRuntimeTables = (tables: RuntimeTables): string[] =>
    RUNTIME_TABLE_KEYS.map((key) => {
        const { name, annotation } = RUNTIME_TABLE_SPECS[key];
        return `export const ${name}: ${annotation} = ${JSON.stringify(tables[key], null, 4)};`;
    });

export const generateMetadata = (repository: GirRepository, tables: RuntimeTables): string => {
    const widgets = collectWidgets(repository);
    const signalsEntries = widgets.map(
        ({ glibName, signals }) => `    "${glibName}": ${renderSignalsObject(signals)},`,
    );
    const constructOnlyEntries = widgets
        .filter(({ constructOnly }) => constructOnly.length > 0)
        .map(({ glibName, constructOnly }) => `    "${glibName}": ${renderStringSet(constructOnly)},`);
    const constructableEntries = widgets
        .filter(({ constructable }) => constructable.length > 0)
        .map(({ glibName, constructable }) => `    "${glibName}": ${renderStringSet(constructable)},`);
    const defaultsEntries = widgets
        .filter(({ defaults }) => defaults.length > 0)
        .map(({ glibName, defaults }) => `    "${glibName}": ${renderDefaultsObject(defaults)},`);

    return `${[
        `export const SIGNALS: Record<string, Record<string, string>> = {\n${signalsEntries.join("\n")}\n};`,
        `export const CONSTRUCT_ONLY_PROPS: Record<string, Set<string>> = {\n${constructOnlyEntries.join("\n")}\n};`,
        `export const CONSTRUCT_PROPS: Record<string, Set<string>> = {\n${constructableEntries.join("\n")}\n};`,
        `export const DEFAULT_PROPS: Record<string, Record<string, unknown>> = {\n${defaultsEntries.join("\n")}\n};`,
        ...renderRuntimeTables(tables),
    ].join("\n\n")}\n`;
};

type WidgetEntry = {
    glibName: string;
    namespace: string;
    signals: [string, string][];
    constructOnly: string[];
    constructable: string[];
    defaults: [string, string][];
};

const collectWidgets = (repository: GirRepository): WidgetEntry[] => {
    const entries: WidgetEntry[] = [];
    for (const { glibName, klass, namespace } of iterateClassesWithGlibName(repository)) {
        if (!isReactNodeClass(klass, namespace, repository)) continue;
        const sources: GirClass[] = [
            klass,
            ...implementedInterfaces(klass, namespace, repository).map((entry) => entry.klass),
        ];
        entries.push({
            glibName,
            namespace: namespace.name,
            signals: collectSignals(sources),
            constructOnly: collectConstructOnly(sources),
            constructable: collectConstructable(sources),
            defaults: collectDefaultProps(repository, sources),
        });
    }
    return sortedAlphaBy(entries, (entry) => entry.glibName);
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
    const lines = entries.map(([key, value]) => `        ${quote(key)}: ${renderValue(value)}`);
    return `{\n${lines.join(",\n")}\n    }`;
};

const renderStringSet = (names: string[]): string => `new Set([${names.map(quote).join(",")}])`;

const renderSignalsObject = (entries: [string, string][]): string => renderObjectLiteral(entries, quote);

const collectDefaultProps = (repository: GirRepository, sources: GirClass[]): [string, string][] => {
    const seen = new Set<string>();
    const defaults: [string, string][] = [];
    for (const klass of sources) {
        for (const property of klass.properties) {
            const settable = (property.writable || property.construct) && !property.constructOnly;
            if (!settable || !property.introspectable) continue;
            const jsName = toCamelIdentifier(property.name);
            if (seen.has(jsName)) continue;
            seen.add(jsName);
            const literal = renderDefaultLiteral(repository, property);
            if (literal === undefined) continue;
            defaults.push([jsName, literal] as const);
        }
    }
    return defaults;
};

const renderDefaultLiteral = (repository: GirRepository, property: GirProperty): string | undefined =>
    resolveDefaultLiteral(repository, property.type, property.defaultValue);

const resolveDefaultLiteral = (
    repository: GirRepository,
    ref: TypeId | undefined,
    raw: string | undefined,
): string | undefined => {
    if (raw === undefined) return undefined;
    if (raw === "NULL") return "null";
    if (ref === undefined) return undefined;
    const resolved = repository.typeOf(ref);
    if (resolved === undefined) return undefined;
    if (resolved.kind === "primitive") return primitiveDefaultLiteral(resolved.category, raw);
    if (resolved.kind === "enum") return enumDefaultLiteral(resolved.value, raw);
    if (resolved.kind === "alias") return resolveDefaultLiteral(repository, resolved.target, raw);
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
            return quote(raw);
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
