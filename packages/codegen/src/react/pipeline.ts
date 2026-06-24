import { sortedAlphaBy } from "@gtkx/utils";
import { type GirNamespace, namespaceDirectory } from "../gir/namespace.js";
import type { GirRepository } from "../gir/repository.js";
import { collectAttachShapes } from "./attach-shapes.js";
import { generateElementComponentsSection } from "./compounds.js";
import { emptyJsxImports, renderJsxImports } from "./imports.js";
import { generateJsxSection } from "./jsx.js";
import { generateMetadata } from "./metadata.js";
import {
    DEFAULT_BLOCKABLE_TYPES,
    META_OBJECT_ADD_METHODS,
    ORDERED_INSERT,
    PAGE_META_SETTERS,
    SLOT_PROPS_BY_TYPE,
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

export const generateJsxFiles = (repository: GirRepository): JsxFiles => {
    const namespacesWithWidgets = new Map<string, GirNamespace>();
    for (const entry of collectReactNodeClasses(repository)) {
        namespacesWithWidgets.set(entry.namespace.name, entry.namespace);
    }

    const namespaces: JsxNamespaceFile[] = [];
    let widgetCount = 0;
    for (const namespace of sortedAlphaBy(namespacesWithWidgets.values(), (entry) => entry.name)) {
        const { source, count } = generateJsxNamespace(namespace, repository);
        namespaces.push({ directory: namespaceDirectory(namespace), source });
        widgetCount += count;
    }

    const metadata = generateMetadata(repository, {
        topLevelTypes: TOP_LEVEL_TYPES,
        defaultBlockableTypes: DEFAULT_BLOCKABLE_TYPES,
        metaObjectAddMethods: META_OBJECT_ADD_METHODS,
        pageMetaSetters: PAGE_META_SETTERS,
        attachShapes: collectAttachShapes(repository),
        orderedInsert: ORDERED_INSERT,
        slotProps: SLOT_PROPS_BY_TYPE,
    });

    return { namespaces, metadata, widgetCount };
};

const generateJsxNamespace = (
    targetNamespace: GirNamespace,
    repository: GirRepository,
): { source: string; count: number } => {
    const imports = emptyJsxImports();

    const elementComponents = generateElementComponentsSection(targetNamespace, repository, { imports });
    const excludeNames = new Set<string>(elementComponents.exportedNames);
    const { source: jsxSection, intrinsicCount } = generateJsxSection(targetNamespace, repository, {
        excludeNames,
        imports,
    });

    const body = [renderJsxImports(namespaceDirectory(targetNamespace), imports), "", jsxSection];
    if (elementComponents.source.length > 0) body.push("", elementComponents.source);

    const count = elementComponents.exportedNames.size + intrinsicCount;
    return { source: `${body.join("\n")}\n`, count };
};
