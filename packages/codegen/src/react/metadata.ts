import type {
    AddMethodRule,
    ArrayPropRow,
    ElementMapRule,
    ObjectPropRow,
    PageMetaSetter,
    PropRule,
    VirtualPropRow,
} from "@gtkx/config";
import { quote, toCamelCase, toIdentifier } from "@gtkx/utils";
import type { GirClass } from "../gir/class.js";
import type { GirEnum } from "../gir/enum.js";
import type { GirProperty } from "../gir/property.js";
import type { GirRepository } from "../gir/repository.js";
import type { GirTypeRef, PrimitiveTypeRef } from "../gir/type-ref.js";
import { implementedInterfaces, isReactNodeClass, iterateClassesWithGlibName, signalHandlerName } from "./widgets.js";

/** A class qualified by the namespace its property type references resolve against. */
type QualifiedSource = { readonly klass: GirClass; readonly namespaceName: string };

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
    readonly containerSlots: Readonly<Record<string, readonly string[]>>;
};

const CONFIG_TYPES = "@gtkx/config";

const renderTableConst = (name: string, annotation: string, value: unknown): string =>
    `export const ${name}: ${annotation} = ${JSON.stringify(value, null, 4)};`;

const renderRuntimeTables = (tables: RuntimeTables): readonly string[] => [
    renderTableConst("ELEMENT_MAP", `ReadonlyArray<import("${CONFIG_TYPES}").ElementMapRule>`, tables.elementMap),
    renderTableConst(
        "ARRAY_PROPS",
        `Readonly<Record<string, Readonly<Record<string, import("${CONFIG_TYPES}").ArrayPropRow>>>>`,
        tables.arrayProps,
    ),
    renderTableConst(
        "OBJECT_PROPS",
        `Readonly<Record<string, Readonly<Record<string, import("${CONFIG_TYPES}").ObjectPropRow>>>>`,
        tables.objectProps,
    ),
    renderTableConst(
        "VIRTUAL_PROPS",
        `Readonly<Record<string, Readonly<Record<string, import("${CONFIG_TYPES}").VirtualPropRow>>>>`,
        tables.virtualProps,
    ),
    renderTableConst(
        "PROP_RULES",
        `Readonly<Record<string, ReadonlyArray<import("${CONFIG_TYPES}").PropRule>>>`,
        tables.propRules,
    ),
    renderTableConst("TOP_LEVEL_TYPES", "readonly string[]", tables.topLevelTypes),
    renderTableConst(
        "META_OBJECT_ADD_METHODS",
        `Readonly<Record<string, ReadonlyArray<import("${CONFIG_TYPES}").AddMethodRule>>>`,
        tables.metaObjectAddMethods,
    ),
    renderTableConst(
        "PAGE_META_SETTERS",
        `ReadonlyArray<import("${CONFIG_TYPES}").PageMetaSetter>`,
        tables.pageMetaSetters,
    ),
    renderTableConst("CONTAINER_SLOTS", "Readonly<Record<string, readonly string[]>>", tables.containerSlots),
];

/**
 * Generates `metadata.ts` source — the merged `SIGNALS`, `CONSTRUCT_ONLY_PROPS`,
 * and `DEFAULT_PROPS` tables consumed by the React metadata resolver, plus the
 * reconciler's {@link RuntimeTables} (built-ins merged with the project's
 * config rows).
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
        .map(({ glibName, constructOnly }) => `    "${glibName}": new Set([${constructOnly.map(quote).join(",")}]),`);
    const defaultsEntries = widgets
        .filter(({ defaults }) => defaults.length > 0)
        .map(({ glibName, defaults }) => `    "${glibName}": ${renderDefaultsObject(defaults)},`);

    return `${[
        `export const SIGNALS: Readonly<Record<string, Readonly<Record<string, string>>>> = {\n${signalsEntries.join("\n")}\n};`,
        `export const CONSTRUCT_ONLY_PROPS: Readonly<Record<string, ReadonlySet<string>>> = {\n${constructOnlyEntries.join("\n")}\n};`,
        `export const DEFAULT_PROPS: Readonly<Record<string, Readonly<Record<string, unknown>>>> = {\n${defaultsEntries.join("\n")}\n};`,
        ...renderRuntimeTables(tables),
    ].join("\n\n")}\n`;
};

type WidgetEntry = {
    readonly glibName: string;
    readonly namespace: string;
    readonly signals: ReadonlyArray<readonly [string, string]>;
    readonly constructOnly: readonly string[];
    readonly defaults: ReadonlyArray<readonly [string, string]>;
};

const collectWidgets = (repository: GirRepository): readonly WidgetEntry[] => {
    const entries: WidgetEntry[] = [];
    for (const { glibName, klass, namespace } of iterateClassesWithGlibName(repository)) {
        if (!isReactNodeClass(klass, namespace, repository)) continue;
        const qualifiedSources: readonly QualifiedSource[] = [
            { klass, namespaceName: namespace.name },
            ...implementedInterfaces(klass, namespace, repository).map((entry) => ({
                klass: entry.klass,
                namespaceName: entry.namespace.name,
            })),
        ];
        const sources = qualifiedSources.map((source) => source.klass);
        entries.push({
            glibName,
            namespace: namespace.name,
            signals: collectSignals(sources),
            constructOnly: collectConstructOnly(sources),
            defaults: collectDefaultProps(repository, qualifiedSources),
        });
    }
    return entries.sort((a, b) => a.glibName.localeCompare(b.glibName));
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

const collectConstructOnly = (sources: readonly GirClass[]): readonly string[] => {
    const seen = new Set<string>();
    const names: string[] = [];
    for (const source of sources) {
        for (const property of source.properties) {
            if (!property.constructOnly || !property.introspectable) continue;
            const jsName = toIdentifier(toCamelCase(property.name));
            if (seen.has(jsName)) continue;
            seen.add(jsName);
            names.push(jsName);
        }
    }
    return names;
};

const renderSignalsObject = (entries: ReadonlyArray<readonly [string, string]>): string => {
    if (entries.length === 0) return "{}";
    const lines = entries.map(([key, value]) => `        ${quote(key)}: ${quote(value)}`);
    return `{\n${lines.join(",\n")}\n    }`;
};

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
    sources: readonly QualifiedSource[],
): ReadonlyArray<readonly [string, string]> => {
    const seen = new Set<string>();
    const defaults: Array<readonly [string, string]> = [];
    for (const { klass, namespaceName } of sources) {
        for (const property of klass.properties) {
            const settable = (property.writable || property.construct) && !property.constructOnly;
            if (!settable || !property.introspectable) continue;
            const jsName = toIdentifier(toCamelCase(property.name));
            if (seen.has(jsName)) continue;
            seen.add(jsName);
            const literal = renderDefaultLiteral(repository, namespaceName, property);
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
 * @param namespaceName - The namespace the property type resolves against
 * @param property - The property whose default to coerce
 */
const renderDefaultLiteral = (
    repository: GirRepository,
    namespaceName: string,
    property: GirProperty,
): string | undefined => resolveDefaultLiteral(repository, namespaceName, property.type, property.defaultValue);

const resolveDefaultLiteral = (
    repository: GirRepository,
    namespaceName: string,
    ref: GirTypeRef | undefined,
    raw: string | undefined,
): string | undefined => {
    if (raw === undefined) return undefined;
    if (raw === "NULL") return "null";
    if (ref === undefined) return undefined;
    if (ref.kind === "primitive") return primitiveDefaultLiteral(ref, raw);
    if (ref.kind !== "named") return undefined;
    const resolved = repository.resolveNamed(ref.namespaceName ?? namespaceName, ref.typeName);
    if (resolved === undefined) return undefined;
    if (resolved.kind === "enum") return enumDefaultLiteral(resolved.value, raw);
    if (resolved.kind === "alias")
        return resolveDefaultLiteral(repository, resolved.namespace.name, resolved.targetRef, raw);
    return undefined;
};

const INTEGER_PATTERN = /^-?\d+$/;

const primitiveDefaultLiteral = (ref: PrimitiveTypeRef, raw: string): string | undefined => {
    switch (ref.category) {
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

const renderDefaultsObject = (entries: ReadonlyArray<readonly [string, string]>): string => {
    if (entries.length === 0) return "{}";
    const lines = entries.map(([key, literal]) => `        ${quote(key)}: ${literal}`);
    return `{\n${lines.join(",\n")}\n    }`;
};
