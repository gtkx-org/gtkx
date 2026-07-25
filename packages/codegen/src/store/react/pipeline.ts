import { sortStringsBy } from "@gtkx/utils";
import type { Library } from "../../gir/library.js";
import { type GirNamespace, namespaceDirectory } from "../../gir/namespace.js";
import { ImportsBuilder } from "../../writer/imports.js";
import { generateElementComponentsSection } from "./element-components.js";
import { type WrapperElementSpec, wrapperElementSpecs } from "./element-prop-types.js";
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

export const generateJsxFiles = (library: Library, reactSubexports: string[] = []): JsxFiles => {
    const intrinsicElements = collectIntrinsicElementClasses(library);
    const intrinsicElementByGlibName = new Map(intrinsicElements.map((entry) => [entry.glibName, entry]));
    const namespacesWithIntrinsicElements = new Map<string, GirNamespace>();
    for (const entry of intrinsicElements) {
        namespacesWithIntrinsicElements.set(entry.namespace.name, entry.namespace);
    }

    const girIndex = buildGirIndex(library);
    const wrappers = wrapperElementSpecs(girIndex);

    const namespaces: JsxNamespaceFile[] = [];
    let intrinsicElementCount = 0;
    for (const namespace of sortStringsBy(namespacesWithIntrinsicElements.values(), (entry) => entry.name)) {
        const { source, count } = generateJsxNamespace(namespace, library, {
            wrappers: wrappers.get(namespace.name) ?? [],
            intrinsicElements,
            intrinsicElementByGlibName,
            reactSubexports,
        });
        namespaces.push({ directory: namespaceDirectory(namespace), source });
        intrinsicElementCount += count;
    }

    const metadata = generateMetadata(library);

    return { namespaces, metadata, intrinsicElementCount };
};

type JsxNamespaceContext = {
    wrappers: WrapperElementSpec[];
    intrinsicElements: GlibNamedClass[];
    intrinsicElementByGlibName: Map<string, GlibNamedClass>;
    reactSubexports: string[];
};

const generateJsxNamespace = (
    targetNamespace: GirNamespace,
    library: Library,
    context: JsxNamespaceContext,
): { source: string; count: number } => {
    const { wrappers, intrinsicElements, intrinsicElementByGlibName, reactSubexports } = context;
    const targetDirectory = namespaceDirectory(targetNamespace);
    const imports = new ImportsBuilder();
    imports.addSideEffect(`@gtkx/gi/${targetDirectory}`);
    if (reactSubexports.includes(targetDirectory)) imports.addSideEffect(`@gtkx/react/${targetDirectory}`);

    const elementComponents = generateElementComponentsSection(targetNamespace, library, {
        imports,
        wrappers,
        intrinsicElements,
    });
    const excludeNames = new Set<string>(elementComponents.exportedNames);
    const { source: jsxSection, intrinsicCount } = generateJsxSection(targetNamespace, library, {
        excludeNames,
        imports,
        wrappers,
        intrinsicElements,
        intrinsicElementByGlibName,
    });

    const body = [imports.toSource().trimEnd()];
    body.push("", jsxSection);
    if (elementComponents.source.length > 0) body.push("", elementComponents.source);

    const count = elementComponents.exportedNames.size + intrinsicCount;
    return { source: `${body.join("\n")}\n`, count };
};
