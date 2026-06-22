import type { UserTableRows } from "@gtkx/config";
import { sortedAlphaBy } from "@gtkx/utils";
import { type GirNamespace, namespaceDirectory } from "../gir/namespace.js";
import type { GirRepository } from "../gir/repository.js";
import { collectAttachShapes } from "./attach-shapes.js";
import { generateCompoundsSection } from "./compounds.js";
import { emptyJsxImports, renderJsxImports } from "./imports.js";
import { generateJsxSection, type JsxSurfaceMaps } from "./jsx.js";
import { generateMetadata } from "./metadata.js";
import {
    BUILT_IN_PROP_RULES,
    DEFAULT_BLOCKABLE_TYPES,
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

export type JsxNamespaceFile = {
    directory: string;
    source: string;
};

export type JsxFiles = {
    namespaces: JsxNamespaceFile[];
    metadata: string;
    widgetCount: number;
};

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
        defaultBlockableTypes: DEFAULT_BLOCKABLE_TYPES,
        metaObjectAddMethods: META_OBJECT_ADD_METHODS,
        pageMetaSetters: PAGE_META_SETTERS,
        containerProps: containerPropMap,
        attachShapes: collectAttachShapes(repository),
    });

    return { namespaces, metadata, widgetCount };
};

const generateJsxNamespace = (
    targetNamespace: GirNamespace,
    repository: GirRepository,
    maps: Required<JsxSurfaceMaps>,
): { source: string; count: number } => {
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
