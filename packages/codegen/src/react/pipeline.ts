import { sortedStringsBy } from "@gtkx/utils";
import type { Library } from "../gir/library.js";
import { type GirNamespace, namespaceDirectory } from "../gir/namespace.js";
import { collectAttachShapes } from "./attach-shapes.js";
import { generateElementComponentsSection } from "./element-components.js";
import { emptyJsxImports, renderJsxImports } from "./imports.js";
import { collectIntrinsicElementClasses } from "./intrinsic-elements.js";
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

export type JsxNamespaceFile = {
    directory: string;
    source: string;
};

export type JsxFiles = {
    namespaces: JsxNamespaceFile[];
    metadata: string;
    intrinsicElementCount: number;
};

export const generateJsxFiles = (library: Library): JsxFiles => {
    const namespacesWithIntrinsicElements = new Map<string, GirNamespace>();
    for (const entry of collectIntrinsicElementClasses(library)) {
        namespacesWithIntrinsicElements.set(entry.namespace.name, entry.namespace);
    }

    const namespaces: JsxNamespaceFile[] = [];
    let intrinsicElementCount = 0;
    for (const namespace of sortedStringsBy(namespacesWithIntrinsicElements.values(), (entry) => entry.name)) {
        const { source, count } = generateJsxNamespace(namespace, library);
        namespaces.push({ directory: namespaceDirectory(namespace), source });
        intrinsicElementCount += count;
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

    return { namespaces, metadata, intrinsicElementCount };
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
