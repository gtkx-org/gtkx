import type { ArrayPropRow, ElementMapRule } from "@gtkx/config";
import type { GirNamespace } from "../gir/namespace.js";
import type { GirRepository } from "../gir/repository.js";
import { generateCompoundsSection } from "./compounds.js";
import { emptyJsxImports, renderJsxImports } from "./imports.js";
import { generateJsxSection } from "./jsx.js";
import { generateMetadata } from "./metadata.js";
import {
    BUILT_IN_PROP_RULES,
    META_OBJECT_ADD_METHODS,
    mergeArrayProps,
    mergeContainerSlots,
    mergeElementMap,
    mergeSlots,
    PAGE_META_SETTERS,
    TOP_LEVEL_TYPES,
} from "./tables.js";
import { collectReactNodeClasses } from "./widgets.js";

/**
 * User-supplied table overrides from `gtkx.config.ts`, keyed by JSX element
 * name, merged with the built-in rows from `./tables`.
 */
export type UserTables = {
    /** Widget-typed properties to surface as setter-semantics `ReactNode` slots. */
    readonly slots?: Readonly<Record<string, readonly string[]>>;
    /** Container methods to surface as append-semantics `ReactNode` slots. */
    readonly containerSlots?: Readonly<Record<string, readonly string[]>>;
    /** Array-prop rows keyed by JSX element name then camelCase prop name. */
    readonly arrayProps?: Readonly<Record<string, Readonly<Record<string, ArrayPropRow>>>>;
    /** Attach relationships merged after the built-in element-map rows. */
    readonly elementMap?: readonly ElementMapRule[];
};

/**
 * Widget names whose public element a hand-written enhanced component owns (a
 * controller-backed list or combo row, a Cairo drawing area in `@gtkx/react`;
 * the animation components in `@gtkx/animate`). A namespace module emits
 * neither an intrinsic const nor a compound for these — only the `Props`
 * interface and the JSX-element augmentation, which the hand-written component
 * renders against. The app imports the component from its owning package; the
 * namespace module stays free of a competing export.
 */
const RUNTIME_OWNED_WIDGETS: ReadonlySet<string> = new Set([
    "GtkColumnView",
    "GtkColumnViewColumn",
    "GtkConstraintLayout",
    "GtkDrawingArea",
    "GtkDropDown",
    "GtkGridView",
    "GtkListView",
    "GtkSizeGroup",
    "AdwComboRow",
    "AdwSpringAnimation",
    "AdwTimedAnimation",
    "WebKitWebView",
]);

/** One per-namespace `@gtkx/jsx` module: its directory and combined source. */
export type JsxNamespaceFile = {
    /** Lowercased namespace directory name (e.g. `"gtk"`). */
    readonly directory: string;
    /** The combined namespace module source. */
    readonly source: string;
};

/** Result of {@link generateJsxFiles}. */
export type JsxFiles = {
    /** Per-namespace module sources. */
    readonly namespaces: readonly JsxNamespaceFile[];
    /** The merged metadata module source. */
    readonly metadata: string;
    /** Number of widget intrinsics emitted across all namespaces. */
    readonly widgetCount: number;
};

/**
 * Produces the per-namespace `@gtkx/jsx` module sources plus the single
 * merged `metadata.ts`. A namespace gets a module when it contributes at least
 * one React-node class. Each module combines the intrinsic/Props section, the
 * compounds section, the runtime-component re-exports, and the `@gtkx/gi/<ns>`
 * side-effect import.
 *
 * @param repository - The loaded GIR repository
 * @param userTables - Table overrides from `gtkx.config.ts`, merged with the built-ins
 */
export const generateJsxFiles = (repository: GirRepository, userTables: UserTables = {}): JsxFiles => {
    const widgetSlotMap = mergeSlots(userTables.slots);
    const containerSlotMap = mergeContainerSlots(userTables.containerSlots);
    const arrayPropMap = mergeArrayProps(userTables.arrayProps);

    const namespacesWithWidgets = new Map<string, GirNamespace>();
    for (const entry of collectReactNodeClasses(repository)) {
        namespacesWithWidgets.set(entry.namespace.name, entry.namespace);
    }

    const namespaces: JsxNamespaceFile[] = [];
    let widgetCount = 0;
    for (const namespace of [...namespacesWithWidgets.values()].sort((a, b) => a.name.localeCompare(b.name))) {
        const { source, count } = generateJsxNamespace(namespace, repository, {
            widgetSlotMap,
            containerSlotMap,
            arrayPropMap,
        });
        namespaces.push({ directory: namespace.name.toLowerCase(), source });
        widgetCount += count;
    }

    const metadata = generateMetadata(repository, {
        elementMap: mergeElementMap(userTables.elementMap),
        arrayProps: arrayPropMap,
        propRules: BUILT_IN_PROP_RULES,
        topLevelTypes: TOP_LEVEL_TYPES,
        metaObjectAddMethods: META_OBJECT_ADD_METHODS,
        pageMetaSetters: PAGE_META_SETTERS,
        slots: widgetSlotMap,
        containerSlots: containerSlotMap,
    });

    return { namespaces, metadata, widgetCount };
};

/**
 * Generates one namespace's combined `@gtkx/jsx` module: imports + the
 * compounds section + the intrinsic/Props section. Compound-exported names and
 * re-exported runtime components are excluded from the intrinsic consts so the
 * module has no duplicate exports.
 *
 * @param targetNamespace - The namespace this module is generated for
 * @param repository - The loaded GIR repository
 * @param maps - Merged widget-slot, container-slot, and array-prop maps
 */
const generateJsxNamespace = (
    targetNamespace: GirNamespace,
    repository: GirRepository,
    maps: {
        readonly widgetSlotMap: Readonly<Record<string, readonly string[]>>;
        readonly containerSlotMap: Readonly<Record<string, readonly string[]>>;
        readonly arrayPropMap: Readonly<Record<string, Readonly<Record<string, ArrayPropRow>>>>;
    },
): { readonly source: string; readonly count: number } => {
    const imports = emptyJsxImports();

    const compounds = generateCompoundsSection(targetNamespace, repository, {
        imports,
        excludeNames: RUNTIME_OWNED_WIDGETS,
    });
    const excludeNames = new Set<string>([...compounds.exportedNames, ...RUNTIME_OWNED_WIDGETS]);
    const jsxSection = generateJsxSection(targetNamespace, repository, { excludeNames, maps, imports });

    const body = [renderJsxImports(targetNamespace.name.toLowerCase(), imports), "", jsxSection];
    if (compounds.source.length > 0) body.push("", compounds.source);

    const count =
        compounds.exportedNames.size + jsxSection.split("\n").filter((line) => line.startsWith("export const ")).length;
    return { source: `${body.join("\n")}\n`, count };
};
