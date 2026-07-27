import { sortStringsBy } from "@gtkx/utils";
import type { Library } from "../../gir/library.js";
import { type GirNamespace, namespaceDirectory } from "../../gir/namespace.js";
import { ImportsBuilder } from "../../writer/imports.js";
import { type ElementComponentOverrides, generateElementComponentsSection } from "./element-components.js";
import { type ElementProps, setElementProps } from "./element-prop-imports.js";
import { type LazyElementSpec, lazyElementSpecs } from "./element-prop-types.js";
import { buildGirIndex } from "./gir-index.js";
import { collectIntrinsicElementClasses, type GlibNamedClass } from "./intrinsic-elements.js";
import { generateJsxSection } from "./jsx.js";
import { generateMetadata } from "./metadata.js";

type JsxNamespaceFile = {
    directory: string;
    source: string;
};

type JsxFiles = {
    namespaces: JsxNamespaceFile[];
    metadata: string;
    intrinsicElementCount: number;
};

type JsxGenerationOptions = {
    reactSubexports?: string[];
    components?: ElementComponentOverrides;
    props?: ElementProps;
    lazyElements?: string[];
};

type NamespaceFilesOptions = {
    library: Library;
    intrinsicElements: GlibNamedClass[];
    intrinsicElementByGlibName: Map<string, GlibNamedClass>;
    lazyByNamespace: Map<string, LazyElementSpec[]>;
    reactSubexports: string[];
    components: ElementComponentOverrides;
};

type JsxNamespaceContext = {
    lazyElements: LazyElementSpec[];
    intrinsicElements: GlibNamedClass[];
    intrinsicElementByGlibName: Map<string, GlibNamedClass>;
    reactSubexports: string[];
    components: ElementComponentOverrides;
};

const generateJsxFiles = (library: Library, options: JsxGenerationOptions = {}): JsxFiles => {
    setElementProps(options.props ?? {});
    const intrinsicElements = collectIntrinsicElementClasses(library);
    const intrinsicElementByGlibName = new Map(intrinsicElements.map((entry) => [entry.glibName, entry]));
    const girIndex = buildGirIndex(library);
    const lazyByNamespace = lazyElementSpecs(girIndex, options.lazyElements ?? []);

    const { namespaces, intrinsicElementCount } = generateNamespaceFiles({
        library,
        intrinsicElements,
        intrinsicElementByGlibName,
        lazyByNamespace,
        reactSubexports: options.reactSubexports ?? [],
        components: options.components ?? {},
    });

    const metadata = generateMetadata(library);

    return { namespaces, metadata, intrinsicElementCount };
};

const orderedIntrinsicNamespaces = (intrinsicElements: GlibNamedClass[]): GirNamespace[] => {
    const namespacesWithIntrinsicElements: Map<string, GirNamespace> = new Map();

    for (const entry of intrinsicElements) {
        namespacesWithIntrinsicElements.set(entry.namespace.name, entry.namespace);
    }

    return sortStringsBy(namespacesWithIntrinsicElements.values(), (entry) => entry.name);
};

const generateNamespaceFiles = (
    options: NamespaceFilesOptions,
): { namespaces: JsxNamespaceFile[]; intrinsicElementCount: number } => {
    const { library, intrinsicElements, intrinsicElementByGlibName, lazyByNamespace, reactSubexports, components } =
        options;

    const namespaces: JsxNamespaceFile[] = [];
    let intrinsicElementCount = 0;

    for (const namespace of orderedIntrinsicNamespaces(intrinsicElements)) {
        const { source, count } = generateJsxNamespace(namespace, library, {
            lazyElements: lazyByNamespace.get(namespace.name) ?? [],
            intrinsicElements,
            intrinsicElementByGlibName,
            reactSubexports,
            components,
        });

        namespaces.push({ directory: namespaceDirectory(namespace), source });
        intrinsicElementCount += count;
    }

    return { namespaces, intrinsicElementCount };
};

const generateJsxNamespace = (
    targetNamespace: GirNamespace,
    library: Library,
    context: JsxNamespaceContext,
): { source: string; count: number } => {
    const { lazyElements, intrinsicElements, intrinsicElementByGlibName, reactSubexports, components } = context;
    const targetDirectory = namespaceDirectory(targetNamespace);
    const imports = new ImportsBuilder();
    imports.addSideEffect(`@gtkx/gi/${targetDirectory}`);

    if (reactSubexports.includes(targetDirectory)) {
        imports.addSideEffect(`@gtkx/react/${targetDirectory}`);
    }

    const elementComponents = generateElementComponentsSection(targetNamespace, library, {
        imports,
        lazyElements,
        intrinsicElements,
        components,
    });

    const excludeNames: Set<string> = new Set(elementComponents.exportedNames);

    const { source: jsxSection, intrinsicCount } = generateJsxSection(targetNamespace, library, {
        excludeNames,
        imports,
        intrinsicElements,
        intrinsicElementByGlibName,
    });

    const body = [imports.toSource().trimEnd(), "", jsxSection];

    if (elementComponents.source.length > 0) {
        body.push("", elementComponents.source);
    }

    const count = elementComponents.exportedNames.size + intrinsicCount;

    return { source: `${body.join("\n")}\n`, count };
};

export { generateJsxFiles, type JsxNamespaceFile, type JsxGenerationOptions };
