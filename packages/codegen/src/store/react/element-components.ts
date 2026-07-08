import { sourceStringLiteral } from "@gtkx/utils";
import type { Library } from "../../gir/library.js";
import type { GirNamespace } from "../../gir/namespace.js";
import { renderJsDoc } from "../../writer/doc.js";
import type { ImportsBuilder } from "../../writer/imports.js";
import { BUILT_IN_ELEMENT_COMPONENTS, type ElementComponentName } from "./built-ins.js";
import type { ElementPropTypegen, LazyElementSpec } from "./element-prop-types.js";
import { ancestorGlibNames, type GlibNamedClass } from "./intrinsic-elements.js";

type TextNodeElement = {
    flatName: string;
    kind: string;
    propsType: string;
    parent: string;
};

const TEXT_NODE_ELEMENTS: TextNodeElement[] = [
    { flatName: "GtkTextAnchor", kind: "text-anchor", propsType: "TextAnchorProps", parent: "GtkTextView" },
    { flatName: "GtkTextPaintable", kind: "text-paintable", propsType: "TextPaintableProps", parent: "GtkTextView" },
];

type ExportCollector = {
    imports: ImportsBuilder;
    exportedNames: Set<string>;
    exportLines: string[];
};

export const generateElementComponentsSection = (
    targetNamespace: GirNamespace,
    library: Library,
    options: {
        imports: ImportsBuilder;
        typegen: ElementPropTypegen;
        intrinsicElements: GlibNamedClass[];
        intrinsicElementByGlibName: Map<string, GlibNamedClass>;
    },
): { source: string; exportedNames: Set<string> } => {
    const collector: ExportCollector = { imports: options.imports, exportedNames: new Set(), exportLines: [] };

    const inTargetNamespace = (parentGlibName: string): boolean =>
        options.intrinsicElementByGlibName.get(parentGlibName)?.namespace.name === targetNamespace.name;

    const lazyElements = options.typegen.lazyElementExports(targetNamespace.name);
    const textNodes = TEXT_NODE_ELEMENTS.filter((node) => inTargetNamespace(node.parent));
    const virtualNames = new Set([
        ...lazyElements.map((entry) => entry.element),
        ...textNodes.map((node) => node.flatName),
    ]);

    collectCandidateExports(collector, {
        targetNamespace,
        library,
        virtualNames,
        intrinsicElements: options.intrinsicElements,
    });
    collectLazyElementExports(collector, lazyElements);
    collectTextNodeExports(collector, textNodes);

    if (textNodes.length > 0) {
        collector.imports.addNamed("@gtkx/react/internal", "WRAPPER_NODE_ELEMENT", false);
    }
    const source = collector.exportLines.join("\n\n");
    return { source, exportedNames: collector.exportedNames };
};

type CandidateExportOptions = {
    targetNamespace: GirNamespace;
    library: Library;
    virtualNames: Set<string>;
    intrinsicElements: GlibNamedClass[];
};

const collectCandidateExports = (
    collector: ExportCollector,
    { targetNamespace, library, virtualNames, intrinsicElements }: CandidateExportOptions,
): void => {
    for (const candidate of intrinsicElements) {
        if (candidate.namespace.name !== targetNamespace.name) continue;
        if (virtualNames.has(candidate.glibName)) continue;
        const line = renderCandidateExport(candidate, library, collector.imports);
        if (line === null) continue;
        collector.exportLines.push(line);
        collector.exportedNames.add(candidate.glibName);
    }
};

const collectLazyElementExports = (collector: ExportCollector, lazyElements: LazyElementSpec[]): void => {
    for (const spec of lazyElements) {
        collector.imports.addNamed("@gtkx/react/internal", "createLazyElementComponent", false);
        collector.imports.addNamed("react", "ReactNode", true);
        collector.exportLines.push(renderLazyElementExport(spec));
        collector.exportedNames.add(spec.element);
    }
};

const collectTextNodeExports = (collector: ExportCollector, textNodes: TextNodeElement[]): void => {
    for (const node of textNodes) {
        collector.imports.addNamed("@gtkx/react", node.propsType, true);
        collector.imports.addNamed("react", "ReactNode", true);
        collector.exportLines.push(renderTextNodeExport(node));
        collector.exportedNames.add(node.flatName);
    }
};

const renderLazyElementExport = (spec: LazyElementSpec): string => {
    const factory = `createLazyElementComponent<${spec.typeName}>()`;
    const component = `export const ${spec.element}: (props: ${spec.typeName}) => ReactNode = ${factory};`;
    return `${spec.typeSource}\n\n${component}`;
};

const renderTextNodeExport = (node: TextNodeElement): string =>
    `export const ${node.flatName} = (props: ${node.propsType}): ReactNode => (\n    <WRAPPER_NODE_ELEMENT kind=${sourceStringLiteral(node.kind)} {...props} />\n);`;

const renderCandidateExport = (candidate: GlibNamedClass, library: Library, imports: ImportsBuilder): string | null => {
    const { glibName, klass, namespace } = candidate;
    const ancestry = new Set(ancestorGlibNames(klass, namespace, library));
    const wrapper = resolveElementComponent(ancestry);
    imports.addNamed("@gtkx/react/internal", "createElementComponent", false);
    imports.addNamed("react", "ReactNode", true);
    if (wrapper !== undefined) imports.addNamed("@gtkx/react/internal", wrapper, false);
    return `${renderJsDoc(klass.doc)}${renderElementComponentExport(glibName, wrapper)}`;
};

const resolveElementComponent = (types: Set<string>): ElementComponentName | undefined => {
    for (const entry of BUILT_IN_ELEMENT_COMPONENTS) {
        if (entry.types.some((type) => types.has(type))) return entry.componentName;
    }
    return undefined;
};

const renderElementComponentExport = (glibName: string, wrapper: ElementComponentName | undefined): string => {
    const propsType = `${glibName}Props`;
    if (wrapper === undefined) {
        return `export const ${glibName}: (props: ${propsType}) => ReactNode = createElementComponent<${propsType}>(${sourceStringLiteral(glibName)});`;
    }
    const annotation = `(props: ${propsType}) => ReactNode`;
    return `export const ${glibName}: ${annotation} = ${wrapper}<${propsType}>(createElementComponent<${propsType}>(${sourceStringLiteral(glibName)}));`;
};
