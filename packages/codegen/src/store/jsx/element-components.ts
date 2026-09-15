import type { ModuleExport } from "@gtkx/react/config";
import { sanitizeTypeIdentifier, sourceStringLiteral } from "@gtkx/utils";
import type { Library } from "../../gir/library.js";
import type { GirNamespace } from "../../gir/namespace.js";
import type { ImportsBuilder } from "../../writer/imports.js";
import type { LazyElementSpec } from "./element-prop-types.js";
import { externalPackageFor } from "../../gir/external-namespaces.js";
import { getDoc } from "../gi/doc-spec.js";
import { factoryElementPropTypeFor } from "./element-prop-imports.js";
import { isMountableElement } from "./generated-elements.js";
import { ancestorGlibNames, type GlibNamedClass } from "./intrinsic-elements.js";

type ElementComponent = ModuleExport;
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

type ElementComponentExport = {
    glibName: string;
    component: ElementComponent | undefined;
    classRef: string;
    propsType: string;
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
    const { targetNamespace, virtualNames } = options;

    if (candidate.namespace.name !== targetNamespace.name) {
        return;
    }

    if (virtualNames.has(candidate.glibName)) {
        return;
    }

    const line = renderCandidateExport(candidate, collector.imports, options);
    collector.exportLines.push(line);
    collector.exportedNames.add(candidate.glibName);
};

const collectCandidateExports = (collector: ExportCollector, options: CandidateExportOptions): void => {
    for (const candidate of options.intrinsicElements) {
        if (!isMountableElement(candidate)) {
            continue;
        }

        appendCandidateExport(collector, candidate, options);
    }
};

const collectLazyElementExports = (
    collector: ExportCollector,
    lazyElements: LazyElementSpec[],
): void => {
    for (const spec of lazyElements) {
        collector.imports.addNamed("@gtkx/react/internal", "createElementComponent", false);
        collector.imports.addNamed("react", "ReactNode", true);

        const classRef = lazyClassRef(collector, spec);
        collector.exportLines.push(renderLazyElementExport(spec, classRef));
        collector.exportedNames.add(spec.element);
    }
};

const lazyClassRef = (
    collector: ExportCollector,
    spec: LazyElementSpec,
): string => {
    const alias = `${spec.namespaceName}$`;
    const specifier = externalPackageFor(spec.namespaceName) ?? `@gtkx/gi/${spec.namespaceName.toLowerCase()}`;
    collector.imports.addNamespace(specifier, alias, false);

    return `${alias}.${sanitizeTypeIdentifier(spec.className)}`;
};

const renderLazyElementExport = (
    spec: LazyElementSpec,
    classRef: string,
): string => {
    const doc = getDoc(spec);
    const args = [sourceStringLiteral(spec.element), classRef];

    const factory = `/* @__PURE__ */ createElementComponent(${args.join(", ")})`;
    const component = `${doc}export const ${spec.element}: (props: ${spec.typeName}) => ReactNode = ${factory};`;

    return `${doc}${spec.typeSource}\n\n${component}`;
};

const renderCandidateExport = (
    candidate: GlibNamedClass,
    imports: ImportsBuilder,
    options: CandidateExportOptions,
): string => {
    const { library, components } = options;
    const { glibName, klass, namespace } = candidate;
    const ancestry = ancestorGlibNames(klass, namespace, library);
    const factoryProps = factoryElementPropTypeFor(glibName);
    const component = factoryProps === undefined
        ? resolveElementComponent(ancestry, components)
        : components[glibName];
    imports.addNamed("@gtkx/react/internal", "createElementComponent", false);
    imports.addNamed("react", "ReactNode", true);

    if (component !== undefined) {
        imports.addNamed(component.module, component.export, false);
    }

    const alias = `${namespace.name}$`;
    const specifier = externalPackageFor(namespace.name) ?? `@gtkx/gi/${namespace.name.toLowerCase()}`;
    imports.addNamespace(specifier, alias, false);
    const classRef = `${alias}.${sanitizeTypeIdentifier(klass.name)}`;
    const doc = getDoc(klass);

    const propsType = `${glibName}Props`;

    return `${doc}${renderElementComponentExport({ glibName, component, classRef, propsType })}`;
};

const resolveElementComponent = (
    ancestry: string[],
    components: Record<string, ElementComponent>,
): ElementComponent | undefined => {
    for (const name of ancestry) {
        const found = components[name];

        if (found !== undefined && factoryElementPropTypeFor(name) === undefined) {
            return found;
        }
    }

    return undefined;
};

const renderElementComponentExport = (spec: ElementComponentExport): string => {
    const { glibName, component, classRef, propsType } = spec;
    const annotation = `(props: ${propsType}) => ReactNode`;
    const args = [sourceStringLiteral(glibName), classRef];
    const factoryCall = `/* @__PURE__ */ createElementComponent(${args.join(", ")})`;

    if (component === undefined) {
        return `export const ${glibName}: ${annotation} = ${factoryCall};`;
    }

    return `export const ${glibName}: ${annotation} = /* @__PURE__ */ ${component.export}(${factoryCall});`;
};

export { generateElementComponentsSection, type ElementComponentOverrides };
