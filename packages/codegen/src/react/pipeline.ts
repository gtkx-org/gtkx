import type { UserTableRows } from "@gtkx/config";
import { sortedAlphaBy } from "@gtkx/utils";
import { type GirNamespace, namespaceDirectory } from "../gir/namespace.js";
import type { GirRepository } from "../gir/repository.js";
import { generateCompoundsSection } from "./compounds.js";
import { emptyJsxImports, renderJsxImports } from "./imports.js";
import { generateJsxSection, type JsxSurfaceMaps } from "./jsx.js";
import { generateMetadata } from "./metadata.js";
import {
    BUILT_IN_PROP_RULES,
    META_OBJECT_ADD_METHODS,
    mergeArrayProps,
    mergeContainerProps,
    mergeElementMap,
    mergeObjectProps,
    mergeVirtualProps,
    PAGE_META_SETTERS,
    RUNTIME_OWNED_WIDGETS,
    TOP_LEVEL_TYPES,
} from "./tables.js";
import { collectReactNodeClasses } from "./widgets.js";

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
export const generateJsxFiles = (repository: GirRepository, userTables: UserTableRows = {}): JsxFiles => {
    const containerPropMap = mergeContainerProps(userTables.containerProps);
    const arrayPropMap = mergeArrayProps(userTables.arrayProps);
    const objectPropMap = mergeObjectProps(userTables.objectProps);
    const virtualPropMap = mergeVirtualProps(userTables.virtualProps);

    const namespacesWithWidgets = new Map<string, GirNamespace>();
    for (const entry of collectReactNodeClasses(repository)) {
        namespacesWithWidgets.set(entry.namespace.name, entry.namespace);
    }

    const namespaces: JsxNamespaceFile[] = [];
    let widgetCount = 0;
    for (const namespace of sortedAlphaBy(namespacesWithWidgets.values(), (entry) => entry.name)) {
        const { source, count } = generateJsxNamespace(namespace, repository, {
            containerPropMap,
            arrayPropMap,
            objectPropMap,
            virtualPropMap,
        });
        namespaces.push({ directory: namespaceDirectory(namespace), source });
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
        containerProps: containerPropMap,
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
    const { source: jsxSection, intrinsicCount } = generateJsxSection(targetNamespace, repository, {
        excludeNames,
        maps,
        imports,
    });

    const body = [renderJsxImports(namespaceDirectory(targetNamespace), imports), "", jsxSection];
    if (compounds.source.length > 0) body.push("", compounds.source);

    const count = compounds.exportedNames.size + intrinsicCount;
    return { source: `${body.join("\n")}\n`, count };
};
