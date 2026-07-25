import { sourceStringLiteral } from "@gtkx/utils";
import type { Library } from "../../gir/library.js";
import type { GirNamespace } from "../../gir/namespace.js";
import { renderJsDoc } from "../../writer/doc.js";
import type { ImportsBuilder } from "../../writer/imports.js";
import type { LazyElementSpec } from "./element-prop-types.js";
import { ancestorGlibNames, type GlibNamedClass } from "./intrinsic-elements.js";

/** A component that wraps a generated element, keyed by GLib type name (built-in or user-provided). */
export type ElementComponent = { module: string; export: string };

/** User-provided component wrappers keyed by GLib type name, layered over the built-ins. */
export type ElementComponentOverrides = Record<string, ElementComponent>;

/** The built-in component wrappers, with user overrides layered on top (a user key wins on the same type). */
const resolveComponents = (overrides: ElementComponentOverrides): Record<string, ElementComponent> => ({
    GtkApplication: { module: "@gtkx/react/internal", export: "createApplicationComponent" },
    GtkWindow: { module: "@gtkx/react/internal", export: "createWindowComponent" },
    AdwDialog: { module: "@gtkx/react/adw", export: "createDialogComponent" },
    ...overrides,
});

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
    components: Record<string, ElementComponent>;
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

const collectLazyElementExports = (collector: ExportCollector, lazyElements: LazyElementSpec[]): void => {
    for (const spec of lazyElements) {
        collector.imports.addNamed("@gtkx/react/internal", "createElementComponent", false);
        collector.imports.addNamed("react", "ReactNode", true);
        collector.exportLines.push(renderLazyElementExport(spec));
        collector.exportedNames.add(spec.element);
    }
};

const renderLazyElementExport = (spec: LazyElementSpec): string => {
    const factory = `createElementComponent(${sourceStringLiteral(spec.element)})`;
    const component = `export const ${spec.element}: (props: ${spec.typeName}) => ReactNode = ${factory};`;
    return `${spec.typeSource}\n\n${component}`;
};

const renderCandidateExport = (
    candidate: GlibNamedClass,
    library: Library,
    imports: ImportsBuilder,
    components: Record<string, ElementComponent>,
): string | null => {
    const { glibName, klass, namespace } = candidate;
    const ancestry = ancestorGlibNames(klass, namespace, library);
    const component = resolveElementComponent(ancestry, components);
    imports.addNamed("@gtkx/react/internal", "createElementComponent", false);
    imports.addNamed("react", "ReactNode", true);
    if (component !== undefined) imports.addNamed(component.module, component.export, false);
    return `${renderJsDoc(klass.doc)}${renderElementComponentExport(glibName, component)}`;
};

/** The component for the nearest ancestry match, most-derived first; user overrides win on their exact type. */
const resolveElementComponent = (
    ancestry: string[],
    components: Record<string, ElementComponent>,
): ElementComponent | undefined => {
    for (const name of ancestry) {
        const found = components[name];
        if (found !== undefined) return found;
    }
    return undefined;
};

const renderElementComponentExport = (glibName: string, component: ElementComponent | undefined): string => {
    const propsType = `${glibName}Props`;
    if (component === undefined) {
        return `export const ${glibName}: (props: ${propsType}) => ReactNode = createElementComponent(${sourceStringLiteral(glibName)});`;
    }
    const annotation = `(props: ${propsType}) => ReactNode`;
    return `export const ${glibName}: ${annotation} = ${component.export}(createElementComponent(${sourceStringLiteral(glibName)}));`;
};
