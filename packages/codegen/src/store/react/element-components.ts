import { RELATIONSHIP_NODE_ELEMENT, type RelationshipRule } from "@gtkx/config";
import { sortedStringsBy, sourceStringLiteral } from "@gtkx/utils";
import type { Library } from "../../gir/library.js";
import type { GirNamespace } from "../../gir/namespace.js";
import type { ImportsBuilder } from "../../writer/imports.js";
import { ancestorGlibNames, collectIntrinsicElementClasses, type GlibNamedClass } from "./intrinsic-elements.js";
import { type AncestryWrapperName, BUILT_IN_ANCESTRY_WRAPPERS } from "./tables.js";

const RELATIONSHIP_NODE_ELEMENT_CONST = "RelationshipNodeElement";

type CompanionComponentSpec = {
    propsType: string;
    propsTypeArg?: string;
    hoc?: string;
};

const COMPANION_COMPONENT_SPECS: Record<string, CompanionComponentSpec> = {
    GtkStackPage: { propsType: "StackPageProps" },
    AdwViewStackPage: { propsType: "StackPageProps", propsTypeArg: "Adw.ViewStackPage" },
    GtkNotebookPage: { propsType: "NotebookPageProps", hoc: "withNotebookTabLabel" },
    GtkGridChild: { propsType: "GridChildProps" },
    GtkFixedChild: { propsType: "FixedChildProps", hoc: "withFixedTransform" },
    GtkOverlayChild: { propsType: "OverlayChildProps" },
};

const GENERIC_COMPANION_PROPS = "Record<string, unknown>";

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

type CompanionElement = {
    element: string;
    spec: CompanionComponentSpec;
};

export const generateElementComponentsSection = (
    targetNamespace: GirNamespace,
    library: Library,
    options: {
        imports: ImportsBuilder;
        relationships: RelationshipRule[];
    },
): { source: string; exportedNames: Set<string> } => {
    const { imports, relationships } = options;
    const exportedNames = new Set<string>();
    const exportLines: string[] = [];

    const namespaceByGlib = new Map(
        collectIntrinsicElementClasses(library).map((entry) => [entry.glibName, entry.namespace.name]),
    );
    const inTargetNamespace = (parentGlibName: string): boolean =>
        namespaceByGlib.get(parentGlibName) === targetNamespace.name;

    const companionElements = collectCompanionElements(relationships, inTargetNamespace);
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

    for (const { element, spec } of companionElements) {
        imports.addNamed("@gtkx/react", "createRelationshipComponent", false);
        if (spec.hoc !== undefined) imports.addNamed("@gtkx/react", spec.hoc, false);
        if (spec.propsType !== GENERIC_COMPANION_PROPS) imports.addNamed("@gtkx/react", spec.propsType, true);
        imports.addNamed("react", "ReactNode", true);
        exportLines.push(renderCompanionExport(element, spec));
        exportedNames.add(element);
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

const collectCompanionElements = (
    relationships: RelationshipRule[],
    inTargetNamespace: (parentGlibName: string) => boolean,
): CompanionElement[] => {
    const seen = new Set<string>();
    const result: CompanionElement[] = [];
    for (const rule of relationships) {
        if (rule.kind !== "companion" && rule.kind !== "layout-child") continue;
        if (seen.has(rule.element) || !inTargetNamespace(rule.parent)) continue;
        seen.add(rule.element);
        const spec = COMPANION_COMPONENT_SPECS[rule.element] ?? { propsType: GENERIC_COMPANION_PROPS };
        result.push({ element: rule.element, spec });
    }
    return sortedStringsBy(result, (entry) => entry.element);
};

const renderCompanionExport = (element: string, spec: CompanionComponentSpec): string => {
    const propsTypeRef =
        spec.propsTypeArg === undefined ? spec.propsType : `${spec.propsType}<${spec.propsTypeArg}>`;
    const factory = `createRelationshipComponent<${propsTypeRef}>(${sourceStringLiteral(element)})`;
    const annotated = spec.hoc === undefined ? factory : `${spec.hoc}(${factory})`;
    return `export const ${element}: (props: ${propsTypeRef}) => ReactNode = ${annotated};`;
};

const renderTextNodeExport = (node: TextNodeElement): string =>
    `export const ${node.flatName} = (props: ${node.propsType}): ReactNode => (\n    <${RELATIONSHIP_NODE_ELEMENT_CONST} kind=${sourceStringLiteral(node.kind)} {...props} />\n);`;

const renderCandidateExport = (candidate: GlibNamedClass, library: Library, imports: ImportsBuilder): string | null => {
    const { glibName, klass, namespace } = candidate;
    const ancestry = new Set(ancestorGlibNames(klass, namespace, library));
    const wrapper = resolveAncestryWrapper(ancestry);
    imports.addNamed("@gtkx/react", "createElementComponent", false);
    imports.addNamed("@gtkx/react", "SyntheticPropsFor", true);
    imports.addNamed("react", "ReactNode", true);
    if (wrapper !== undefined) imports.addNamed("@gtkx/react", wrapper, false);
    const isDialog = wrapper === "withWindowPresentation" && ancestry.has("AdwDialog");
    if (isDialog) imports.addNamed("@gtkx/react", "ToplevelParentProps", true);
    const syntheticUnion = [...ancestry].map((name) => sourceStringLiteral(name)).join(" | ");
    return renderElementComponentExport(glibName, wrapper, isDialog, syntheticUnion);
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
    syntheticUnion: string,
): string => {
    const propsType = `${glibName}Props & SyntheticPropsFor<${syntheticUnion}>`;
    if (wrapper === undefined) {
        return `export const ${glibName}: (props: ${propsType}) => ReactNode = createElementComponent<${propsType}>(${sourceStringLiteral(glibName)});`;
    }
    const componentPropsType = isDialog ? `${propsType} & ToplevelParentProps` : propsType;
    const annotation = `(props: ${componentPropsType}) => ReactNode`;
    return `export const ${glibName}: ${annotation} = ${wrapper}<${componentPropsType}>(createElementComponent<${componentPropsType}>(${sourceStringLiteral(glibName)}));`;
};
