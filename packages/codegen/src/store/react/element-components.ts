import { sourceStringLiteral } from "@gtkx/utils";
import type { Library } from "../../gir/library.js";
import type { GirNamespace } from "../../gir/namespace.js";
import { renderJsDoc } from "../../writer/doc.js";
import type { ImportsBuilder } from "../../writer/imports.js";
import { BUILT_IN_ELEMENT_COMPONENTS, type ElementComponent } from "./built-ins.js";
import type { ElementPropTypegen, LazyElementSpec } from "./element-prop-types.js";
import { ancestorGlibNames, type GlibNamedClass } from "./intrinsic-elements.js";

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
    },
): { source: string; exportedNames: Set<string> } => {
    const collector: ExportCollector = { imports: options.imports, exportedNames: new Set(), exportLines: [] };

    const lazyElements = options.typegen.lazyElementExports(targetNamespace.name);
    const virtualNames = new Set(lazyElements.map((entry) => entry.element));

    collectCandidateExports(collector, {
        targetNamespace,
        library,
        virtualNames,
        intrinsicElements: options.intrinsicElements,
    });
    collectLazyElementExports(collector, lazyElements);

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

const renderLazyElementExport = (spec: LazyElementSpec): string => {
    const factory = `createLazyElementComponent<${spec.typeName}>()`;
    const component = `export const ${spec.element}: (props: ${spec.typeName}) => ReactNode = ${factory};`;
    return `${spec.typeSource}\n\n${component}`;
};

const renderCandidateExport = (candidate: GlibNamedClass, library: Library, imports: ImportsBuilder): string | null => {
    const { glibName, klass, namespace } = candidate;
    const ancestry = new Set(ancestorGlibNames(klass, namespace, library));
    const wrapper = resolveElementComponent(ancestry);
    imports.addNamed("@gtkx/react/internal", "createElementComponent", false);
    imports.addNamed("react", "ReactNode", true);
    if (wrapper !== undefined) imports.addNamed(wrapper.module, wrapper.export, false);
    return `${renderJsDoc(klass.doc)}${renderElementComponentExport(glibName, wrapper)}`;
};

const resolveElementComponent = (types: Set<string>): ElementComponent | undefined => {
    for (const entry of BUILT_IN_ELEMENT_COMPONENTS) {
        if (entry.types.some((type) => types.has(type))) return entry;
    }
    return undefined;
};

const renderElementComponentExport = (glibName: string, wrapper: ElementComponent | undefined): string => {
    const propsType = `${glibName}Props`;
    if (wrapper === undefined) {
        return `export const ${glibName}: (props: ${propsType}) => ReactNode = createElementComponent(${sourceStringLiteral(glibName)});`;
    }
    const annotation = `(props: ${propsType}) => ReactNode`;
    return `export const ${glibName}: ${annotation} = ${wrapper.export}(createElementComponent(${sourceStringLiteral(glibName)}));`;
};
