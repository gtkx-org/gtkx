import { RELATIONSHIP_NODE_ELEMENT } from "@gtkx/config";
import { sortedStringsBy, sourceStringLiteral, toCamelCase } from "@gtkx/utils";
import type { Library } from "../gir/library.js";
import type { GirNamespace } from "../gir/namespace.js";
import type { JsxImports } from "./imports.js";
import { ancestorGlibNames, collectIntrinsicElementClasses, type IntrinsicElementClass } from "./intrinsic-elements.js";
import { type RelationshipNodeElement, relationshipNodeElementEntries } from "./relationship-node-elements.js";
import { type AncestryWrapperName, BUILT_IN_ANCESTRY_WRAPPERS } from "./tables.js";

const RELATIONSHIP_NODE_ELEMENT_CONST = "RelationshipNodeElement";

export const generateElementComponentsSection = (
    targetNamespace: GirNamespace,
    library: Library,
    options: {
        imports: JsxImports;
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
        imports.sharedTypes.add(relationshipNode.propsType);
        imports.reactBuiltins.add("ReactNode");
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

const renderCandidateExport = (
    candidate: IntrinsicElementClass,
    library: Library,
    imports: JsxImports,
): string | null => {
    const { glibName, klass, namespace } = candidate;
    const ancestry = new Set(ancestorGlibNames(klass, namespace, library));
    const hoc = resolveAncestryWrapper(ancestry);
    imports.hocs.add("createElementComponent");
    imports.sharedTypes.add("SyntheticPropsFor");
    imports.reactBuiltins.add("ReactNode");
    if (hoc !== undefined) imports.hocs.add(hoc);
    const isDialogSurface = hoc === "withWindowPresentation" && ancestry.has("AdwDialog");
    if (isDialogSurface) imports.sharedTypes.add("TopLevelParentProps");
    const syntheticUnion = [...ancestry].map((name) => sourceStringLiteral(name)).join(" | ");
    return renderElementComponentExport(glibName, hoc, isDialogSurface, syntheticUnion);
};

const resolveAncestryWrapper = (ancestry: Set<string>): AncestryWrapperName | undefined => {
    for (const rule of BUILT_IN_ANCESTRY_WRAPPERS) {
        if (rule.ancestors.some((ancestor) => ancestry.has(ancestor))) return rule.hoc;
    }
    return undefined;
};

const renderElementComponentExport = (
    glibName: string,
    hoc: AncestryWrapperName | undefined,
    isDialogSurface: boolean,
    syntheticUnion: string,
): string => {
    const propsType = `${glibName}Props & SyntheticPropsFor<${syntheticUnion}>`;
    if (hoc === undefined) {
        return `export const ${glibName}: (props: ${propsType}) => ReactNode = createElementComponent<${propsType}>(${sourceStringLiteral(glibName)});`;
    }
    const componentPropsType = isDialogSurface ? `${propsType} & TopLevelParentProps` : propsType;
    const annotation = `(props: ${componentPropsType}) => ReactNode`;
    const memo = `${toCamelCase(glibName)}Instance`;
    return [
        `let ${memo}: (${annotation}) | undefined;`,
        `export const ${glibName}: ${annotation} = (props) => (${memo} ??= ${hoc}<${componentPropsType}>(createElementComponent<${componentPropsType}>(${sourceStringLiteral(glibName)})))(props);`,
    ].join("\n");
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
