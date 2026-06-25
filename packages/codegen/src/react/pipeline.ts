import { sortedStringsBy } from "@gtkx/utils";
import { type GirNamespace, namespaceDirectory } from "../gir/namespace.js";
import type { Library } from "../gir/library.js";
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
import { collectReactNodeClasses } from "./react-nodes.js";

export type JsxNamespaceFile = {
    directory: string;
    source: string;
};

export type JsxFiles = {
    namespaces: JsxNamespaceFile[];
    metadata: string;
    reactNodeCount: number;
};

export const generateJsxFiles = (library: Library): JsxFiles => {
    const namespacesWithReactNodes = new Map<string, GirNamespace>();
    for (const entry of collectReactNodeClasses(library)) {
        namespacesWithReactNodes.set(entry.namespace.name, entry.namespace);
    }

    const namespaces: JsxNamespaceFile[] = [];
    let reactNodeCount = 0;
    for (const namespace of sortedStringsBy(namespacesWithReactNodes.values(), (entry) => entry.name)) {
        const { source, count } = generateJsxNamespace(namespace, library);
        namespaces.push({ directory: namespaceDirectory(namespace), source });
        reactNodeCount += count;
    }

    const metadata = generateMetadata(library, {
        topLevelTypes: TOP_LEVEL_TYPES,
        defaultBlockableTypes: DEFAULT_BLOCKABLE_TYPES,
        metaObjectAddMethods: META_OBJECT_ADD_METHODS,
        pageMetaSetters: PAGE_META_SETTERS,
        attachShapes: collectAttachShapes(library),
        orderedInsert: ORDERED_INSERT,
        slotProps: SLOT_PROPS_BY_TYPE,
    });

    return { namespaces, metadata, reactNodeCount };
};

const generateJsxNamespace = (targetNamespace: GirNamespace, library: Library): { source: string; count: number } => {
    const imports = emptyJsxImports();

    const elementComponents = generateElementComponentsSection(targetNamespace, library, { imports });
    const excludeNames = new Set<string>(elementComponents.exportedNames);
    const { source: jsxSection, intrinsicCount } = generateJsxSection(targetNamespace, library, {
        excludeNames,
        imports,
    });

    const body = [renderJsxImports(namespaceDirectory(targetNamespace), imports), "", jsxSection];
    if (elementComponents.source.length > 0) body.push("", elementComponents.source);

    const count = elementComponents.exportedNames.size + intrinsicCount;
    return { source: `${body.join("\n")}\n`, count };
};
