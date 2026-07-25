import { sourceStringLiteral } from "@gtkx/utils";
import type { Library } from "../../gir/library.js";
import type { GirNamespace } from "../../gir/namespace.js";
import { renderJsDoc } from "../../writer/doc.js";
import type { ImportsBuilder } from "../../writer/imports.js";
import type { WrapperElementSpec } from "./element-prop-types.js";
import { ancestorGlibNames, type GlibNamedClass } from "./intrinsic-elements.js";

type ElementComponent = { types: string[]; module: string; export: string };

/** User-provided component wrappers keyed by GLib type name, layered over the built-ins. */
export type ElementComponentOverrides = Record<string, { module: string; export: string }>;

const BUILT_IN_ELEMENT_COMPONENTS: ElementComponent[] = [
    { types: ["GtkApplication"], module: "@gtkx/react/internal", export: "createApplicationComponent" },
    { types: ["GtkWindow"], module: "@gtkx/react/internal", export: "createWindowComponent" },
    { types: ["AdwDialog"], module: "@gtkx/react/adw", export: "createDialogComponent" },
];

/** Layers user component wrappers ahead of the built-ins so a user entry wins on an ancestry match. */
const resolveComponents = (overrides: ElementComponentOverrides): ElementComponent[] => [
    ...Object.entries(overrides).map(([type, { module, export: exportName }]) => ({
        types: [type],
        module,
        export: exportName,
    })),
    ...BUILT_IN_ELEMENT_COMPONENTS,
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
        wrappers: WrapperElementSpec[];
        intrinsicElements: GlibNamedClass[];
        components: ElementComponentOverrides;
    },
): { source: string; exportedNames: Set<string> } => {
    const collector: ExportCollector = { imports: options.imports, exportedNames: new Set(), exportLines: [] };

    const lazyElements = options.wrappers;
    const virtualNames = new Set(lazyElements.map((entry) => entry.element));

    collectCandidateExports(collector, {
        targetNamespace,
        library,
        virtualNames,
        intrinsicElements: options.intrinsicElements,
        components: resolveComponents(options.components),
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
    components: ElementComponent[];
};

const collectCandidateExports = (
    collector: ExportCollector,
    { targetNamespace, library, virtualNames, intrinsicElements, components }: CandidateExportOptions,
): void => {
    for (const candidate of intrinsicElements) {
        if (candidate.namespace.name !== targetNamespace.name) continue;
        if (virtualNames.has(candidate.glibName)) continue;
        const line = renderCandidateExport(candidate, library, collector.imports, components);
        if (line === null) continue;
        collector.exportLines.push(line);
        collector.exportedNames.add(candidate.glibName);
    }
};

const collectLazyElementExports = (collector: ExportCollector, lazyElements: WrapperElementSpec[]): void => {
    for (const spec of lazyElements) {
        collector.imports.addNamed("@gtkx/react/internal", "createElementComponent", false);
        collector.imports.addNamed("react", "ReactNode", true);
        collector.exportLines.push(renderLazyElementExport(spec));
        collector.exportedNames.add(spec.element);
    }
};

const renderLazyElementExport = (spec: WrapperElementSpec): string => {
    const factory = `createElementComponent(${sourceStringLiteral(spec.element)})`;
    const component = `export const ${spec.element}: (props: ${spec.typeName}) => ReactNode = ${factory};`;
    return `${spec.typeSource}\n\n${component}`;
};

const renderCandidateExport = (
    candidate: GlibNamedClass,
    library: Library,
    imports: ImportsBuilder,
    components: ElementComponent[],
): string | null => {
    const { glibName, klass, namespace } = candidate;
    const ancestry = new Set(ancestorGlibNames(klass, namespace, library));
    const wrapper = resolveElementComponent(ancestry, components);
    imports.addNamed("@gtkx/react/internal", "createElementComponent", false);
    imports.addNamed("react", "ReactNode", true);
    if (wrapper !== undefined) imports.addNamed(wrapper.module, wrapper.export, false);
    return `${renderJsDoc(klass.doc)}${renderElementComponentExport(glibName, wrapper)}`;
};

const resolveElementComponent = (types: Set<string>, components: ElementComponent[]): ElementComponent | undefined => {
    for (const entry of components) {
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
