import { RELATIONSHIP_NODE_ELEMENT } from "@gtkx/config";
import { sourceStringLiteral } from "@gtkx/utils";
import type { Library } from "../../gir/library.js";
import type { GirNamespace } from "../../gir/namespace.js";
import type { ImportsBuilder } from "../../writer/imports.js";
import { ancestorGlibNames, collectIntrinsicElementClasses, type GlibNamedClass } from "./intrinsic-elements.js";
import type { CompanionExportSpec, RuleTypegen } from "./synthetic-prop-types.js";
import { type AncestryWrapperName, BUILT_IN_ANCESTRY_WRAPPERS, COMPANION_WRAPPERS } from "./tables.js";

const RELATIONSHIP_NODE_ELEMENT_CONST = "RelationshipNodeElement";

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

export const generateElementComponentsSection = (
    targetNamespace: GirNamespace,
    library: Library,
    options: {
        imports: ImportsBuilder;
        typegen: RuleTypegen;
    },
): { source: string; exportedNames: Set<string> } => {
    const { imports, typegen } = options;
    const exportedNames = new Set<string>();
    const exportLines: string[] = [];

    const namespaceByGlib = new Map(
        collectIntrinsicElementClasses(library).map((entry) => [entry.glibName, entry.namespace.name]),
    );
    const inTargetNamespace = (parentGlibName: string): boolean =>
        namespaceByGlib.get(parentGlibName) === targetNamespace.name;

    const companionElements = typegen.companionExports(targetNamespace.name);
    const textNodes = TEXT_NODE_ELEMENTS.filter((node) => inTargetNamespace(node.parent));
    const virtualNames = new Set([
        ...companionElements.map((entry) => entry.element),
        ...textNodes.map((node) => node.flatName),
    ]);

    for (const candidate of collectIntrinsicElementClasses(library)) {
        if (candidate.namespace.name !== targetNamespace.name) continue;
        if (virtualNames.has(candidate.glibName)) continue;
        const line = renderCandidateExport(candidate, library, imports);
        if (line === null) continue;
        exportLines.push(line);
        exportedNames.add(candidate.glibName);
    }

    for (const spec of companionElements) {
        imports.addNamed("@gtkx/react", "createRelationshipComponent", false);
        imports.addNamed("react", "ReactNode", true);
        for (const [namespaceName, alias] of spec.imports) {
            if (namespaceName !== "") imports.addNamespace(`@gtkx/gi/${namespaceName.toLowerCase()}`, alias, true);
        }
        const wrapper = COMPANION_WRAPPERS[spec.element];
        if (wrapper !== undefined) imports.addNamed("@gtkx/react", wrapper, false);
        exportLines.push(renderCompanionExport(spec, wrapper));
        exportedNames.add(spec.element);
    }

    let needsWrapperConst = false;
    for (const node of textNodes) {
        needsWrapperConst = true;
        imports.addNamed("@gtkx/react", node.propsType, true);
        imports.addNamed("react", "ReactNode", true);
        exportLines.push(renderTextNodeExport(node));
        exportedNames.add(node.flatName);
    }

    const sections = [
        needsWrapperConst
            ? `const ${RELATIONSHIP_NODE_ELEMENT_CONST} = ${sourceStringLiteral(RELATIONSHIP_NODE_ELEMENT)} as const;`
            : "",
        exportLines.join("\n\n"),
    ];
    const source = sections.filter((section) => section.length > 0).join("\n\n");
    return { source, exportedNames };
};

const renderCompanionExport = (spec: CompanionExportSpec, wrapper: string | undefined): string => {
    const factory = `createRelationshipComponent<${spec.typeName}>(${sourceStringLiteral(spec.element)})`;
    const component =
        wrapper === undefined
            ? `export const ${spec.element}: (props: ${spec.typeName}) => ReactNode = ${factory};`
            : `export const ${spec.element}: ReturnType<typeof ${wrapper}<${spec.typeName}>> = ${wrapper}(${factory});`;
    return `${spec.typeSource}\n\n${component}`;
};

const renderTextNodeExport = (node: TextNodeElement): string =>
    `export const ${node.flatName} = (props: ${node.propsType}): ReactNode => (\n    <${RELATIONSHIP_NODE_ELEMENT_CONST} kind=${sourceStringLiteral(node.kind)} {...props} />\n);`;

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
