import type { ModuleExport } from "@gtkx/react/config";
import { sanitizeTypeIdentifier, sourceStringLiteral } from "@gtkx/utils";
import type { Library } from "../../gir/library.js";
import type { GirNamespace } from "../../gir/namespace.js";
import type { ImportsBuilder } from "../../writer/imports.js";
import type { LazyElementSpec } from "./element-prop-types.js";
import type { GirIndex } from "./gir-index.js";
import { externalPackageFor } from "../../gir/external-namespaces.js";
import { getDoc } from "../gi/doc-spec.js";
import { constructOnlyPropNames, renderGeneratedElementProps } from "./element-construct-only.js";
import { factoryElementPropTypeFor } from "./element-prop-imports.js";
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
    girIndex: GirIndex;
    virtualNames: Set<string>;
    intrinsicElements: GlibNamedClass[];
    components: Record<string, ElementComponent>;
};

type LazyMetadataOptions = {
    intrinsicNames: Set<string>;
};

type ElementComponentExport = {
    glibName: string;
    component: ElementComponent | undefined;
    classRef: string;
    metadataRef: string;
    propsType: string;
};

const METADATA_ALIAS = "Metadata$";

const generateElementComponentsSection = (
    targetNamespace: GirNamespace,
    library: Library,
    options: {
        imports: ImportsBuilder;
        lazyElements: LazyElementSpec[];
        intrinsicElements: GlibNamedClass[];
        components: ElementComponentOverrides;
        girIndex: GirIndex;
    },
): { source: string; exportedNames: Set<string> } => {
    const collector: ExportCollector = { imports: options.imports, exportedNames: new Set(), exportLines: [] };
    const lazyElements = options.lazyElements;
    const virtualNames = new Set(lazyElements.map((entry) => entry.element));

    collectCandidateExports(collector, {
        targetNamespace,
        library,
        girIndex: options.girIndex,
        virtualNames,
        intrinsicElements: options.intrinsicElements,
        components: options.components,
    });

    collectLazyElementExports(collector, lazyElements, {
        intrinsicNames: new Set(options.intrinsicElements.map((entry) => entry.glibName)),
    });

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
        if (candidate.klass.isAbstract && factoryElementPropTypeFor(candidate.glibName) === undefined) {
            continue;
        }

        appendCandidateExport(collector, candidate, options);
    }
};

const collectLazyElementExports = (
    collector: ExportCollector,
    lazyElements: LazyElementSpec[],
    options: LazyMetadataOptions,
): void => {
    for (const spec of lazyElements) {
        collector.imports.addNamed("@gtkx/react/internal", "createElementComponent", false);
        collector.imports.addNamed("react", "ReactNode", true);

        const refs = {
            classRef: lazyClassRef(collector, spec),
            metadataRef: lazyMetadataRef(collector, spec, options),
        };

        collector.exportLines.push(renderLazyElementExport(spec, refs));
        collector.exportedNames.add(spec.element);
    }
};

const lazyMetadataRef = (
    collector: ExportCollector,
    spec: LazyElementSpec,
    options: LazyMetadataOptions,
): string | undefined => {
    if (!options.intrinsicNames.has(spec.element)) {
        return undefined;
    }

    collector.imports.addNamespace("../metadata.js", METADATA_ALIAS, false);

    return `${METADATA_ALIAS}.${spec.element}`;
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
    refs: { classRef: string; metadataRef: string | undefined },
): string => {
    const doc = getDoc(spec);
    const args = [sourceStringLiteral(spec.element), refs.classRef];

    if (refs.metadataRef !== undefined) {
        args.push(refs.metadataRef);
    }

    const factory = `/* @__PURE__ */ createElementComponent(${args.join(", ")})`;
    const component = `${doc}export const ${spec.element}: (props: ${spec.typeName}) => ReactNode = ${factory};`;

    return `${doc}${spec.typeSource}\n\n${component}`;
};

const renderCandidateExport = (
    candidate: GlibNamedClass,
    imports: ImportsBuilder,
    options: CandidateExportOptions,
): string => {
    const { library, girIndex, components } = options;
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

    if (factoryProps !== undefined) {
        imports.addNamed(factoryProps.module, factoryProps.export, true);
    }

    const alias = `${namespace.name}$`;
    const specifier = externalPackageFor(namespace.name) ?? `@gtkx/gi/${namespace.name.toLowerCase()}`;
    imports.addNamespace(specifier, alias, false);
    imports.addNamespace("../metadata.js", METADATA_ALIAS, false);
    const classRef = `${alias}.${sanitizeTypeIdentifier(klass.name)}`;
    const metadataRef = `${METADATA_ALIAS}.${glibName}`;
    const doc = getDoc(klass);

    const basePropsType = factoryProps === undefined
        ? `${glibName}Props`
        : `${glibName}Props & ${factoryProps.export}`;
    const constructOnly = constructOnlyPropNames(girIndex, candidate);

    if (constructOnly.length > 0) {
        imports.addNamed("@gtkx/react/internal", "GeneratedElementProps", true);
    }

    const propsType = renderGeneratedElementProps(basePropsType, constructOnly);

    return `${doc}${renderElementComponentExport({ glibName, component, classRef, metadataRef, propsType })}`;
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
    const { glibName, component, classRef, metadataRef, propsType } = spec;
    const annotation = `(props: ${propsType}) => ReactNode`;
    const args = [sourceStringLiteral(glibName), classRef, metadataRef];
    const factoryCall = `/* @__PURE__ */ createElementComponent(${args.join(", ")})`;

    if (component === undefined) {
        return `export const ${glibName}: ${annotation} = ${factoryCall};`;
    }

    return `export const ${glibName}: ${annotation} = /* @__PURE__ */ ${component.export}(${factoryCall});`;
};

export { generateElementComponentsSection, type ElementComponentOverrides };
