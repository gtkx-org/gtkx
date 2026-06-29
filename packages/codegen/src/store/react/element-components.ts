import { RELATIONSHIP_NODE_ELEMENT } from "@gtkx/config";
import { sortedStringsBy, sourceStringLiteral } from "@gtkx/utils";
import type { Library } from "../../gir/library.js";
import type { GirNamespace } from "../../gir/namespace.js";
import type { ImportsBuilder } from "../../writer/imports.js";
import { ancestorGlibNames, collectIntrinsicElementClasses, type GlibNamedClass } from "./intrinsic-elements.js";
import { type RelationshipNodeElement, relationshipNodeElementEntries } from "./relationship-node-elements.js";
import { type AncestryWrapperName, BUILT_IN_ANCESTRY_WRAPPERS } from "./tables.js";

const RELATIONSHIP_NODE_ELEMENT_CONST = "RelationshipNodeElement";

export const generateElementComponentsSection = (
    targetNamespace: GirNamespace,
    library: Library,
    options: {
        imports: ImportsBuilder;
    },
): { source: string; exportedNames: Set<string> } => {
    const { imports } = options;
    const exportedNames = new Set<string>();
    const exportLines: string[] = [];
    let needsWrapperConst = false;

    const relationshipNodes = relationshipNodeElementsForNamespace(targetNamespace, library);
    const virtualNames = new Set(relationshipNodes.map((relationshipNode) => relationshipNode.flatName));

    for (const candidate of collectIntrinsicElementClasses(library)) {
        if (candidate.namespace.name !== targetNamespace.name) continue;
        if (virtualNames.has(candidate.glibName)) continue;
        const line = renderCandidateExport(candidate, library, imports);
        if (line === null) continue;
        exportLines.push(line);
        exportedNames.add(candidate.glibName);
    }

    for (const relationshipNode of relationshipNodes) {
        needsWrapperConst = true;
        imports.addNamed("@gtkx/react", relationshipNode.propsType, true);
        imports.addNamed("react", "ReactNode", true);
        exportLines.push(renderRelationshipNodeElementExport(relationshipNode));
        exportedNames.add(relationshipNode.flatName);
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

const relationshipNodeElementsForNamespace = (
    targetNamespace: GirNamespace,
    library: Library,
): RelationshipNodeElement[] => {
    const namespaceByGlib = new Map(
        collectIntrinsicElementClasses(library).map((entry) => [entry.glibName, entry.namespace.name]),
    );
    const seen = new Set<string>();
    const result: RelationshipNodeElement[] = [];
    for (const { parentGlibName, relationshipNode } of relationshipNodeElementEntries()) {
        if (seen.has(relationshipNode.flatName)) continue;
        seen.add(relationshipNode.flatName);
        if (namespaceByGlib.get(parentGlibName) === targetNamespace.name) result.push(relationshipNode);
    }
    return sortedStringsBy(result, (entry) => entry.flatName);
};

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

const renderPositionalSlotChild = (kind: string, prop: string): string =>
    `{${prop} != null && <${RELATIONSHIP_NODE_ELEMENT_CONST} kind=${sourceStringLiteral(kind)}>{${prop}}</${RELATIONSHIP_NODE_ELEMENT_CONST}>}`;

const renderRelationshipNodeElementExport = (relationshipNode: RelationshipNodeElement): string => {
    const { flatName, kind, propsType, slot } = relationshipNode;
    if (slot === undefined) {
        return `export const ${flatName} = (props: ${propsType}): ReactNode => (\n    <${RELATIONSHIP_NODE_ELEMENT_CONST} kind=${sourceStringLiteral(kind)} {...props} />\n);`;
    }
    return [
        `export const ${flatName} = (props: ${propsType}): ReactNode => {`,
        `    const { ${slot.prop}, children, ...rest } = props;`,
        "    return (",
        `        <${RELATIONSHIP_NODE_ELEMENT_CONST} kind=${sourceStringLiteral(kind)} {...rest}>`,
        "            {children}",
        `            ${renderPositionalSlotChild(slot.kind, slot.prop)}`,
        `        </${RELATIONSHIP_NODE_ELEMENT_CONST}>`,
        "    );",
        "};",
    ].join("\n");
};
