import type { ArrayPropRow, ElementMapRule, ObjectPropRow, VirtualPropRow } from "@gtkx/config";
import type { GirNamespace } from "../gir/namespace.js";
import type { GirRepository } from "../gir/repository.js";
import { generateCompoundsSection } from "./compounds.js";
import { emptyJsxImports, renderJsxImports } from "./imports.js";
import { generateJsxSection, type JsxSurfaceMaps } from "./jsx.js";
import { generateMetadata } from "./metadata.js";
import {
    BUILT_IN_PROP_RULES,
    META_OBJECT_ADD_METHODS,
    mergeArrayProps,
    mergeContainerSlots,
    mergeElementMap,
    mergeObjectProps,
    mergeSlots,
    mergeVirtualProps,
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
    /** Object-prop rows keyed by JSX element name then camelCase prop name. */
    readonly objectProps?: Readonly<Record<string, Readonly<Record<string, ObjectPropRow>>>>;
    /** Virtual-prop rows keyed by JSX element name then camelCase prop name. */
    readonly virtualProps?: Readonly<Record<string, Readonly<Record<string, VirtualPropRow>>>>;
    /** Attach relationships merged after the built-in element-map rows. */
    readonly elementMap?: readonly ElementMapRule[];
};

/**
 * Names with no generated component: classes a hand-written enhanced
 * component owns (a controller-backed list or combo row in `@gtkx/react`; the
 * animation components in `@gtkx/animate`) plus classes that are not elements
 * at all (`GMenuItem` — menu content is the `<GMenu>` `items` data prop). A
 * namespace module emits only the `Props` interface and the JSX-element
 * augmentation for these; the owning package exports the component, where one
 * exists.
 */
const RUNTIME_OWNED_WIDGETS: ReadonlySet<string> = new Set([
    "GtkColumnView",
    "GtkColumnViewColumn",
    "GtkConstraintLayout",
    "GtkDropDown",
    "GtkGridView",
    "GtkListView",
    "GMenuItem",
    "AdwComboRow",
    "AdwSpringAnimation",
    "AdwTimedAnimation",
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
    const objectPropMap = mergeObjectProps(userTables.objectProps);
    const virtualPropMap = mergeVirtualProps(userTables.virtualProps);

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
            objectPropMap,
            virtualPropMap,
        });
        namespaces.push({ directory: namespace.name.toLowerCase(), source });
        widgetCount += count;
    }

    const metadata = generateMetadata(repository, {
        elementMap: mergeElementMap(userTables.elementMap),
        arrayProps: arrayPropMap,
        objectProps: objectPropMap,
        virtualProps: virtualPropMap,
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
    maps: Required<JsxSurfaceMaps>,
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
