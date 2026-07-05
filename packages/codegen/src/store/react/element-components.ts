import { WRAPPER_NODE_ELEMENT } from "@gtkx/config";
import { sourceStringLiteral } from "@gtkx/utils";
import type { Library } from "../../gir/library.js";
import type { GirNamespace } from "../../gir/namespace.js";
import type { ImportsBuilder } from "../../writer/imports.js";
import { ancestorGlibNames, collectIntrinsicElementClasses, type GlibNamedClass } from "./intrinsic-elements.js";
import type { CompanionExportSpec, RuleTypegen } from "./synthetic-prop-types.js";
import { type AncestryWrapperName, BUILT_IN_ANCESTRY_WRAPPERS } from "./tables.js";

const WRAPPER_NODE_ELEMENT_CONST = "WrapperNodeElement";

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
        typegen: RuleTypegen;
    },
): { source: string; exportedNames: Set<string> } => {
    const collector: ExportCollector = { imports: options.imports, exportedNames: new Set(), exportLines: [] };

    const namespaceByGlib = new Map(
        collectIntrinsicElementClasses(library).map((entry) => [entry.glibName, entry.namespace.name]),
    );
    const inTargetNamespace = (parentGlibName: string): boolean =>
        namespaceByGlib.get(parentGlibName) === targetNamespace.name;

    const companionElements = options.typegen.companionExports(targetNamespace.name);
    const textNodes = TEXT_NODE_ELEMENTS.filter((node) => inTargetNamespace(node.parent));
    const virtualNames = new Set([
        ...companionElements.map((entry) => entry.element),
        ...textNodes.map((node) => node.flatName),
    ]);

    collectCandidateExports(collector, targetNamespace, library, virtualNames);
    collectCompanionExports(collector, companionElements);
    collectTextNodeExports(collector, textNodes);

    const sections = [
        textNodes.length > 0
            ? `const ${WRAPPER_NODE_ELEMENT_CONST} = ${sourceStringLiteral(WRAPPER_NODE_ELEMENT)} as const;`
            : "",
        collector.exportLines.join("\n\n"),
    ];
    const source = sections.filter((section) => section.length > 0).join("\n\n");
    return { source, exportedNames: collector.exportedNames };
};

const collectCandidateExports = (
    collector: ExportCollector,
    targetNamespace: GirNamespace,
    library: Library,
    virtualNames: Set<string>,
): void => {
    for (const candidate of collectIntrinsicElementClasses(library)) {
        if (candidate.namespace.name !== targetNamespace.name) continue;
        if (virtualNames.has(candidate.glibName)) continue;
        const line = renderCandidateExport(candidate, library, collector.imports);
        if (line === null) continue;
        collector.exportLines.push(line);
        collector.exportedNames.add(candidate.glibName);
    }
};

const collectCompanionExports = (collector: ExportCollector, companionElements: CompanionExportSpec[]): void => {
    for (const spec of companionElements) {
        collector.imports.addNamed("@gtkx/react", "createWrapperComponent", false);
        collector.imports.addNamed("react", "ReactNode", true);
        for (const [namespaceName, alias] of spec.imports) {
            if (namespaceName !== "") {
                collector.imports.addNamespace(`@gtkx/gi/${namespaceName.toLowerCase()}`, alias, true);
            }
        }
        collector.exportLines.push(renderCompanionExport(spec));
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

const renderCompanionExport = (spec: CompanionExportSpec): string => {
    const factory = `createWrapperComponent<${spec.typeName}>(${sourceStringLiteral(spec.element)})`;
    const component = `export const ${spec.element}: (props: ${spec.typeName}) => ReactNode = ${factory};`;
    return `${spec.typeSource}\n\n${component}`;
};

const renderTextNodeExport = (node: TextNodeElement): string =>
    `export const ${node.flatName} = (props: ${node.propsType}): ReactNode => (\n    <${WRAPPER_NODE_ELEMENT_CONST} kind=${sourceStringLiteral(node.kind)} {...props} />\n);`;

const renderCandidateExport = (candidate: GlibNamedClass, library: Library, imports: ImportsBuilder): string | null => {
    const { glibName, klass, namespace } = candidate;
    const ancestry = new Set(ancestorGlibNames(klass, namespace, library));
    const wrapper = resolveAncestryWrapper(ancestry);
    imports.addNamed("@gtkx/react", "createElementComponent", false);
    imports.addNamed("react", "ReactNode", true);
    if (wrapper !== undefined) imports.addNamed("@gtkx/react", wrapper, false);
    const isDialog = wrapper === "withWindowPresentation" && ancestry.has("AdwDialog");
    if (isDialog) imports.addNamed("@gtkx/react", "ToplevelParentProps", true);
    return renderElementComponentExport(glibName, wrapper, isDialog);
};

const resolveAncestryWrapper = (ancestry: Set<string>): AncestryWrapperName | undefined => {
    for (const rule of BUILT_IN_ANCESTRY_WRAPPERS) {
        if (rule.ancestors.some((ancestor) => ancestry.has(ancestor))) return rule.wrapper;
    }
    return undefined;
};

const renderElementComponentExport = (
    glibName: string,
    wrapper: AncestryWrapperName | undefined,
    isDialog: boolean,
): string => {
    const propsType = `${glibName}Props`;
    if (wrapper === undefined) {
        return `export const ${glibName}: (props: ${propsType}) => ReactNode = createElementComponent<${propsType}>(${sourceStringLiteral(glibName)});`;
    }
    const componentPropsType = isDialog ? `${propsType} & ToplevelParentProps` : propsType;
    const annotation = `(props: ${componentPropsType}) => ReactNode`;
    return `export const ${glibName}: ${annotation} = ${wrapper}<${componentPropsType}>(createElementComponent<${componentPropsType}>(${sourceStringLiteral(glibName)}));`;
};
