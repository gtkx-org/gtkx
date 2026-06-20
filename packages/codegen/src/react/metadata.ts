import type {
    AddMethodRule,
    ArrayPropRow,
    ElementMapRule,
    ObjectPropRow,
    PageMetaSetter,
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

/**
 * The reconciler's data tables baked into the generated metadata module: the
 * built-ins merged with the project's `gtkx.config.ts` rows, in the row
 * shapes declared by `@gtkx/config`.
 */
export type RuntimeTables = {
    /** Merged attach relationships, built-ins first. */
    readonly elementMap: readonly ElementMapRule[];
    /** Merged array-prop rows keyed by GLib type name, then prop name. */
    readonly arrayProps: Readonly<Record<string, Readonly<Record<string, ArrayPropRow>>>>;
    /** Merged object-prop rows keyed by GLib type name, then prop name. */
    readonly objectProps: Readonly<Record<string, Readonly<Record<string, ObjectPropRow>>>>;
    /** Merged virtual-prop rows keyed by GLib type name, then prop name. */
    readonly virtualProps: Readonly<Record<string, Readonly<Record<string, VirtualPropRow>>>>;
    /** Imperative and signal prop rules keyed by GLib type name. */
    readonly propRules: Readonly<Record<string, readonly PropRule[]>>;
    /** GLib type names of top-level surfaces. */
    readonly topLevelTypes: readonly string[];
    /** Page-add method priority rows for stack-like parents. */
    readonly metaObjectAddMethods: Readonly<Record<string, readonly AddMethodRule[]>>;
    /** Page-metadata setters applied to stack page handles. */
    readonly pageMetaSetters: readonly PageMetaSetter[];
    /** Merged container-slot method names keyed by JSX element name. */
    readonly containerProps: Readonly<Record<string, readonly string[]>>;
};

const configType = (name: string): string => `import("@gtkx/config").${name}`;

const nestedRecordOf = (rowType: string): string =>
    `Readonly<Record<string, Readonly<Record<string, ${configType(rowType)}>>>>`;

const recordOfArray = (rowType: string): string => `Readonly<Record<string, ReadonlyArray<${configType(rowType)}>>>`;

const arrayOf = (rowType: string): string => `ReadonlyArray<${configType(rowType)}>`;

/**
 * The generated const name and TypeScript annotation for one {@link RuntimeTables}
 * field, baked next to its value as a `JSON.stringify`d literal.
 */
type RuntimeTableSpec = {
    /** The exported const identifier. */
    readonly name: string;
    /** The TypeScript type annotation, re-spelling the field's `@gtkx/config` shape. */
    readonly annotation: string;
};

const RUNTIME_TABLE_SPECS: Readonly<Record<keyof RuntimeTables, RuntimeTableSpec>> = {
    elementMap: { name: "ELEMENT_MAP", annotation: arrayOf("ElementMapRule") },
    arrayProps: { name: "ARRAY_PROPS", annotation: nestedRecordOf("ArrayPropRow") },
    objectProps: { name: "OBJECT_PROPS", annotation: nestedRecordOf("ObjectPropRow") },
    virtualProps: { name: "VIRTUAL_PROPS", annotation: nestedRecordOf("VirtualPropRow") },
    propRules: { name: "PROP_RULES", annotation: recordOfArray("PropRule") },
    topLevelTypes: { name: "TOP_LEVEL_TYPES", annotation: "readonly string[]" },
    metaObjectAddMethods: { name: "META_OBJECT_ADD_METHODS", annotation: recordOfArray("AddMethodRule") },
    pageMetaSetters: { name: "PAGE_META_SETTERS", annotation: arrayOf("PageMetaSetter") },
    containerProps: { name: "CONTAINER_PROPS", annotation: "Readonly<Record<string, readonly string[]>>" },
};

const RUNTIME_TABLE_KEYS = Object.keys(RUNTIME_TABLE_SPECS) as ReadonlyArray<keyof RuntimeTables>;

const renderRuntimeTables = (tables: RuntimeTables): readonly string[] =>
    RUNTIME_TABLE_KEYS.map((key) => {
        const { name, annotation } = RUNTIME_TABLE_SPECS[key];
        return `export const ${name}: ${annotation} = ${JSON.stringify(tables[key], null, 4)};`;
    });

/**
 * Generates `metadata.ts` source — the merged `SIGNALS`, `CONSTRUCT_ONLY_PROPS`,
 * `CONSTRUCT_PROPS`, and `DEFAULT_PROPS` tables consumed by the React metadata
 * resolver, plus the reconciler's {@link RuntimeTables} (built-ins merged with
 * the project's config rows).
 *
 * The tables are pure data keyed by GLib type name and carry no value imports
 * from any namespace, so the module loads no GObject library: it is delivered to
 * `@gtkx/react` through the `virtual:gtkx-config` Vite module. Signals are mapped
 * from kebab-case to `onCamelCase`; construct-only properties are surfaced as a
 * `Set` for the runtime to consult on mount; each settable property's GIR
 * `default-value` is coerced to a JS literal so the reconciler can reset a removed
 * prop to its default.
 *
 * @param repository - The loaded GIR repository
 * @param tables - The merged reconciler tables to bake in
 */
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
        `export const SIGNALS: Readonly<Record<string, Readonly<Record<string, string>>>> = {\n${signalsEntries.join("\n")}\n};`,
        `export const CONSTRUCT_ONLY_PROPS: Readonly<Record<string, ReadonlySet<string>>> = {\n${constructOnlyEntries.join("\n")}\n};`,
        `export const CONSTRUCT_PROPS: Readonly<Record<string, ReadonlySet<string>>> = {\n${constructableEntries.join("\n")}\n};`,
        `export const DEFAULT_PROPS: Readonly<Record<string, Readonly<Record<string, unknown>>>> = {\n${defaultsEntries.join("\n")}\n};`,
        ...renderRuntimeTables(tables),
    ].join("\n\n")}\n`;
};

type WidgetEntry = {
    readonly glibName: string;
    readonly namespace: string;
    readonly signals: ReadonlyArray<readonly [string, string]>;
    readonly constructOnly: readonly string[];
    readonly constructable: readonly string[];
    readonly defaults: ReadonlyArray<readonly [string, string]>;
};

const collectWidgets = (repository: GirRepository): readonly WidgetEntry[] => {
    const entries: WidgetEntry[] = [];
    for (const { glibName, klass, namespace } of iterateClassesWithGlibName(repository)) {
        if (!isReactNodeClass(klass, namespace, repository)) continue;
        const sources: readonly GirClass[] = [
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

const collectSignals = (sources: readonly GirClass[]): ReadonlyArray<readonly [string, string]> => {
    const seen = new Set<string>();
    const signals: Array<readonly [string, string]> = [];
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

/**
 * Collects the camelCase names of the properties a class introduces — its own
 * and its implemented interfaces' — that `keep` selects. Each name is considered
 * once, nearest source winning.
 *
 * @param sources - The class and its implemented interfaces.
 * @param keep - Predicate selecting which properties to include.
 */
const collectPropNames = (
    sources: readonly GirClass[],
    keep: (property: GirProperty) => boolean,
): readonly string[] => {
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

/** The construct-only camelCase property names a class introduces. */
const collectConstructOnly = (sources: readonly GirClass[]): readonly string[] =>
    collectPropNames(sources, (property) => property.constructOnly && property.introspectable);

/**
 * The camelCase names of every constructable property a class introduces — its
 * own and its implemented interfaces', that are writable, construct, or
 * construct-only — mirroring exactly the props the generated constructor
 * destructures and marshals through `g_object_new_with_properties`. The
 * reconciler narrows a JSX prop bag to this set before constructing, so only
 * real GObject properties reach construction.
 *
 * @param sources - The class and its implemented interfaces.
 */
const collectConstructable = (sources: readonly GirClass[]): readonly string[] =>
    collectPropNames(sources, isConstructableProperty);

/**
 * Renders a `glibName`-keyed entry's value as an object literal: empty collapses
 * to `{}`, otherwise each pair is quoted-key, `renderValue`d-value, two-level
 * indented with the closing brace at the entry's own indent.
 *
 * @param entries - The key/value pairs to render
 * @param renderValue - Renders each pair's value to source (e.g. quoting it)
 */
const renderObjectLiteral = (
    entries: ReadonlyArray<readonly [string, string]>,
    renderValue: (value: string) => string,
): string => {
    if (entries.length === 0) return "{}";
    const lines = entries.map(([key, value]) => `        ${quote(key)}: ${renderValue(value)}`);
    return `{\n${lines.join(",\n")}\n    }`;
};

/** Renders a list of property names as a `new Set([...])` of quoted strings. */
const renderStringSet = (names: readonly string[]): string => `new Set([${names.map(quote).join(",")}])`;

const renderSignalsObject = (entries: ReadonlyArray<readonly [string, string]>): string =>
    renderObjectLiteral(entries, quote);

/**
 * Collects the settable properties a class introduces (its own plus those of
 * the interfaces it implements) whose GIR `default-value` coerces to a JS
 * literal, paired with that literal. Read-only and construct-only properties
 * are excluded — the reconciler never resets them. Each property name is
 * considered once, nearest source winning.
 *
 * @param repository - The loaded GIR repository
 * @param sources - The class and its implemented interfaces, with namespaces
 */
const collectDefaultProps = (
    repository: GirRepository,
    sources: readonly GirClass[],
): ReadonlyArray<readonly [string, string]> => {
    const seen = new Set<string>();
    const defaults: Array<readonly [string, string]> = [];
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

/**
 * Coerces a property's GIR `default-value` to the JS literal the reconciler
 * assigns when the prop is removed. The coerced value is the property's declared
 * default, so setting it back is always valid. Returns `undefined` when the
 * default is absent or cannot be resolved (e.g. an object property whose default
 * is not `NULL`), in which case the property is omitted and never reset.
 *
 * @param repository - The loaded GIR repository
 * @param property - The property whose default to coerce
 */
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

/**
 * Resolves an enum/flags `default-value` — a numeric literal or a member's C
 * identifier — to the member's integer value as a string.
 */
const enumDefaultLiteral = (enumType: GirEnum, raw: string): string | undefined => {
    const trimmed = raw.trim();
    if (INTEGER_PATTERN.test(trimmed)) return trimmed;
    const member = enumType.members.find((entry) => entry.cIdentifier === trimmed || entry.name === trimmed);
    return member?.value;
};

const renderDefaultsObject = (entries: ReadonlyArray<readonly [string, string]>): string =>
    renderObjectLiteral(entries, (literal) => literal);
