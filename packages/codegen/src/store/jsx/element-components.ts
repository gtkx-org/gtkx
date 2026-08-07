import { sourceStringLiteral } from "@gtkx/utils";
import type { Library } from "../../gir/library.js";
import type { GirNamespace } from "../../gir/namespace.js";
import type { ImportsBuilder } from "../../writer/imports.js";
import type { LazyElementSpec } from "./element-prop-types.js";
import { getDoc } from "../gi/doc-spec.js";
import { ancestorGlibNames, type GlibNamedClass } from "./intrinsic-elements.js";

type ElementComponent = { module: string; export: string };
type ElementComponentOverrides = Record<string, ElementComponent>;

type ExportCollector = {
    imports: ImportsBuilder;
    exportedNames: Set<string>;
    exportLines: string[];
};

type CandidateExportOptions = {
    targetNamespace: GirNamespace;
    library: Library;
    virtualNames: Set<string>;
    intrinsicElements: GlibNamedClass[];
    components: Record<string, ElementComponent>;
};

const generateElementComponentsSection = (
    targetNamespace: GirNamespace,
    library: Library,
    options: {
        imports: ImportsBuilder;
        lazyElements: LazyElementSpec[];
        intrinsicElements: GlibNamedClass[];
        components: ElementComponentOverrides;
    },
): { source: string; exportedNames: Set<string> } => {
    const collector: ExportCollector = { imports: options.imports, exportedNames: new Set(), exportLines: [] };
    const lazyElements = options.lazyElements;
    const virtualNames = new Set(lazyElements.map((entry) => entry.element));

    collectCandidateExports(collector, {
        targetNamespace,
        library,
        virtualNames,
        intrinsicElements: options.intrinsicElements,
        components: options.components,
    });

    collectLazyElementExports(collector, lazyElements);
    const source = collector.exportLines.join("\n\n");

    return { source, exportedNames: collector.exportedNames };
};

const appendCandidateExport = (
    collector: ExportCollector,
    candidate: GlibNamedClass,
    options: CandidateExportOptions,
): void => {
    const { targetNamespace, library, virtualNames, components } = options;

    if (candidate.namespace.name !== targetNamespace.name) {
        return;
    }

    if (virtualNames.has(candidate.glibName)) {
        return;
    }

    const line = renderCandidateExport(candidate, library, collector.imports, components);
    collector.exportLines.push(line);
    collector.exportedNames.add(candidate.glibName);
};

const collectCandidateExports = (collector: ExportCollector, options: CandidateExportOptions): void => {
    for (const candidate of options.intrinsicElements) {
        if (candidate.klass.isAbstract) {
            continue;
        }

        appendCandidateExport(collector, candidate, options);
    }
};

const collectLazyElementExports = (collector: ExportCollector, lazyElements: LazyElementSpec[]): void => {
    for (const spec of lazyElements) {
        collector.imports.addNamed("@gtkx/react/internal", "createElementComponent", false);
        collector.imports.addNamed("react", "ReactNode", true);
        collector.exportLines.push(renderLazyElementExport(spec));
        collector.exportedNames.add(spec.element);
    }
};

const renderLazyElementExport = (spec: LazyElementSpec): string => {
    const doc = getDoc(spec);
    const factory = `createElementComponent(${sourceStringLiteral(spec.element)})`;
    const component = `${doc}export const ${spec.element}: (props: ${spec.typeName}) => ReactNode = ${factory};`;

    return `${doc}${spec.typeSource}\n\n${component}`;
};

const renderCandidateExport = (
    candidate: GlibNamedClass,
    library: Library,
    imports: ImportsBuilder,
    components: Record<string, ElementComponent>,
): string => {
    const { glibName, klass, namespace } = candidate;
    const ancestry = ancestorGlibNames(klass, namespace, library);
    const component = resolveElementComponent(ancestry, components);
    imports.addNamed("@gtkx/react/internal", "createElementComponent", false);
    imports.addNamed("react", "ReactNode", true);

    if (component !== undefined) {
        imports.addNamed(component.module, component.export, false);
    }

    const doc = getDoc(klass);

    return `${doc}${renderElementComponentExport(glibName, component)}`;
};

const resolveElementComponent = (
    ancestry: string[],
    components: Record<string, ElementComponent>,
): ElementComponent | undefined => {
    for (const name of ancestry) {
        const found = components[name];

        if (found !== undefined) {
            return found;
        }
    }

    return undefined;
};

const renderElementComponentExport = (glibName: string, component: ElementComponent | undefined): string => {
    const propsType = `${glibName}Props`;
    const annotation = `(props: ${propsType}) => ReactNode`;
    const factoryCall = `createElementComponent(${sourceStringLiteral(glibName)})`;

    if (component === undefined) {
        return `export const ${glibName}: ${annotation} = ${factoryCall};`;
    }

    return `export const ${glibName}: ${annotation} = ${component.export}(${factoryCall});`;
};

export { generateElementComponentsSection, type ElementComponentOverrides };
