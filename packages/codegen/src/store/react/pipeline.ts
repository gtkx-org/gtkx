import type { ElementProp } from "@gtkx/config";
import { sortStringsBy } from "@gtkx/utils";
import type { Library } from "../../gir/library.js";
import { type GirNamespace, namespaceDirectory } from "../../gir/namespace.js";
import { ImportsBuilder } from "../../writer/imports.js";
import { generateElementComponentsSection } from "./element-components.js";
import { createElementPropTypegen, type ElementPropTypegen } from "./element-prop-types.js";
import { assembleElementProps } from "./element-props.js";
import { buildGirIndex } from "./gir-index.js";
import { collectIntrinsicElementClasses, type GlibNamedClass } from "./intrinsic-elements.js";
import { generateJsxSection } from "./jsx.js";
import { generateMetadata } from "./metadata.js";

export type JsxNamespaceFile = {
    directory: string;
    source: string;
};

type JsxFiles = {
    namespaces: JsxNamespaceFile[];
    metadata: string;
    intrinsicElementCount: number;
};

export const generateJsxFiles = (library: Library, userElementProps?: Record<string, ElementProp[]>): JsxFiles => {
    const intrinsicElements = collectIntrinsicElementClasses(library);
    const intrinsicElementByGlibName = new Map(intrinsicElements.map((entry) => [entry.glibName, entry]));
    const namespacesWithIntrinsicElements = new Map<string, GirNamespace>();
    for (const entry of intrinsicElements) {
        namespacesWithIntrinsicElements.set(entry.namespace.name, entry.namespace);
    }

    const girIndex = buildGirIndex(library);
    const elementProps = assembleElementProps(girIndex, userElementProps ?? {});
    const typegen = createElementPropTypegen(girIndex, elementProps);

    const namespaces: JsxNamespaceFile[] = [];
    let intrinsicElementCount = 0;
    for (const namespace of sortStringsBy(namespacesWithIntrinsicElements.values(), (entry) => entry.name)) {
        const { source, count } = generateJsxNamespace(namespace, library, {
            typegen,
            intrinsicElements,
            intrinsicElementByGlibName,
        });
        namespaces.push({ directory: namespaceDirectory(namespace), source });
        intrinsicElementCount += count;
    }

    const metadata = generateMetadata(library, elementProps);

    return { namespaces, metadata, intrinsicElementCount };
};

type JsxNamespaceContext = {
    typegen: ElementPropTypegen;
    intrinsicElements: GlibNamedClass[];
    intrinsicElementByGlibName: Map<string, GlibNamedClass>;
};

const generateJsxNamespace = (
    targetNamespace: GirNamespace,
    library: Library,
    context: JsxNamespaceContext,
): { source: string; count: number } => {
    const { typegen, intrinsicElements, intrinsicElementByGlibName } = context;
    const targetDirectory = namespaceDirectory(targetNamespace);
    const imports = new ImportsBuilder();
    imports.addSideEffect(`@gtkx/gi/${targetDirectory}`);

    const elementComponents = generateElementComponentsSection(targetNamespace, library, {
        imports,
        typegen,
        intrinsicElements,
        intrinsicElementByGlibName,
    });
    const excludeNames = new Set<string>(elementComponents.exportedNames);
    const { source: jsxSection, intrinsicCount } = generateJsxSection(targetNamespace, library, {
        excludeNames,
        imports,
        typegen,
        intrinsicElements,
        intrinsicElementByGlibName,
    });

    const body = [imports.toSource().trimEnd(), "", jsxSection];
    if (elementComponents.source.length > 0) body.push("", elementComponents.source);

    const count = elementComponents.exportedNames.size + intrinsicCount;
    return { source: `${body.join("\n")}\n`, count };
};
