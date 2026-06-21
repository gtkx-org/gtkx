import { WRAPPER_NODE_ELEMENT } from "@gtkx/config";
import { quote, sortedAlphaBy, toCamelCase } from "@gtkx/utils";
import type { GirNamespace } from "../gir/namespace.js";
import type { GirRepository } from "../gir/repository.js";
import { type VirtualSubcomponent, virtualSubcomponentEntries } from "./compounds-meta.js";
import type { JsxImports } from "./imports.js";
import { BUILT_IN_COMPOUND_HOCS, type CompoundHoc, type RuntimeComponentWrapper, widgetWrapper } from "./tables.js";
import { ancestorGlibNames, collectReactNodeClasses, type WidgetCandidate } from "./widgets.js";

const WRAPPER_ELEMENT_CONST = "WrapperNodeElement";

export const generateCompoundsSection = (
    targetNamespace: GirNamespace,
    repository: GirRepository,
    options: {
        imports: JsxImports;
        excludeNames: Set<string>;
    },
): { source: string; exportedNames: Set<string> } => {
    const { imports, excludeNames } = options;
    const exportedNames = new Set<string>();
    const exportLines: string[] = [];
    let needsWrapperConst = false;

    const virtuals = virtualSubcomponentsForNamespace(targetNamespace, repository);
    const virtualNames = new Set(virtuals.map((virtual) => virtual.flatName));

    for (const candidate of collectReactNodeClasses(repository)) {
        if (candidate.namespace.name !== targetNamespace.name) continue;
        if (virtualNames.has(candidate.glibName)) continue;
        const line = renderCandidateExport(candidate, repository, imports, excludeNames);
        if (line === null) continue;
        exportLines.push(line);
        exportedNames.add(candidate.glibName);
    }

    for (const virtual of virtuals) {
        needsWrapperConst = true;
        imports.sharedTypes.add(virtual.propsType);
        imports.reactBuiltins.add("ReactNode");
        exportLines.push(renderVirtualSubcomponent(virtual));
        exportedNames.add(virtual.flatName);
    }

    const sections = [
        needsWrapperConst ? `const ${WRAPPER_ELEMENT_CONST} = ${quote(WRAPPER_NODE_ELEMENT)} as const;` : "",
        exportLines.join("\n\n"),
    ];
    const source = sections.filter((section) => section.length > 0).join("\n\n");
    return { source, exportedNames };
};

const virtualSubcomponentsForNamespace = (
    targetNamespace: GirNamespace,
    repository: GirRepository,
): VirtualSubcomponent[] => {
    const namespaceByGlib = new Map(
        collectReactNodeClasses(repository).map((entry) => [entry.glibName, entry.namespace.name]),
    );
    const seen = new Set<string>();
    const result: VirtualSubcomponent[] = [];
    for (const { parentGlibName, virtual } of virtualSubcomponentEntries()) {
        if (seen.has(virtual.flatName)) continue;
        seen.add(virtual.flatName);
        if (namespaceByGlib.get(parentGlibName) === targetNamespace.name) result.push(virtual);
    }
    return sortedAlphaBy(result, (entry) => entry.flatName);
};

const renderRuntimeWrapper = (glibName: string, wrapper: RuntimeComponentWrapper, imports: JsxImports): string => {
    if (wrapper.kind === "reexport") {
        return `export { ${glibName} } from "@gtkx/react";`;
    }
    const alias = `Runtime${glibName}`;
    imports.hocs.add(`${glibName} as ${alias}`);
    imports.reactBuiltins.add("ReactNode");
    if (wrapper.kind === "typedProps") {
        return `export const ${glibName}: (props: ${glibName}Props) => ReactNode = ${alias};`;
    }
    for (const sharedType of wrapper.sharedTypes) imports.sharedTypes.add(sharedType);
    const omitKeys = wrapper.omitKeys ?? `keyof ${wrapper.controllerProps}`;
    const propsExpr = `Omit<${glibName}Props, ${omitKeys}> & ${wrapper.controllerProps}`;
    return `export const ${glibName}: ${wrapper.genericParams}(props: ${propsExpr}) => ReactNode = ${alias};`;
};

const renderCandidateExport = (
    candidate: WidgetCandidate,
    repository: GirRepository,
    imports: JsxImports,
    excludeNames: Set<string>,
): string | null => {
    const { glibName, klass, namespace } = candidate;
    const wrapper = widgetWrapper(glibName);
    if (wrapper !== undefined) return renderRuntimeWrapper(glibName, wrapper, imports);
    if (excludeNames.has(glibName)) return null;
    const ancestry = new Set(ancestorGlibNames(klass, namespace, repository));
    const hoc = compoundHoc(ancestry);
    imports.hocs.add("createElementComponent");
    imports.reactBuiltins.add("ReactNode");
    if (hoc !== undefined) imports.hocs.add(hoc);
    const isDialogSurface = hoc === "withTopLevel" && ancestry.has("AdwDialog");
    if (isDialogSurface) imports.sharedTypes.add("TopLevelParentProps");
    return renderCompound(glibName, hoc, isDialogSurface);
};

const compoundHoc = (ancestry: Set<string>): CompoundHoc | undefined => {
    for (const rule of BUILT_IN_COMPOUND_HOCS) {
        if (rule.ancestors.some((ancestor) => ancestry.has(ancestor))) return rule.hoc;
    }
    return undefined;
};

const renderCompound = (glibName: string, hoc: CompoundHoc | undefined, isDialogSurface: boolean): string => {
    const propsType = `${glibName}Props`;
    if (hoc === undefined) {
        return `export const ${glibName}: (props: ${propsType}) => ReactNode = createElementComponent<${propsType}>(${quote(glibName)});`;
    }
    const componentPropsType = isDialogSurface ? `${propsType} & TopLevelParentProps` : propsType;
    const annotation = `(props: ${componentPropsType}) => ReactNode`;
    const memo = `${toCamelCase(glibName)}Instance`;
    return [
        `let ${memo}: (${annotation}) | undefined;`,
        `export const ${glibName}: ${annotation} = (props) => (${memo} ??= ${hoc}<${componentPropsType}>(createElementComponent<${componentPropsType}>(${quote(glibName)})))(props);`,
    ].join("\n");
};

const renderPositionalSlotChild = (kind: string, prop: string): string =>
    `{${prop} != null && <${WRAPPER_ELEMENT_CONST} kind=${quote(kind)}>{${prop}}</${WRAPPER_ELEMENT_CONST}>}`;

const renderVirtualSubcomponent = (virtual: VirtualSubcomponent): string => {
    const { flatName, kind, propsType, slot } = virtual;
    if (slot === undefined) {
        return `export const ${flatName} = (props: ${propsType}): ReactNode => (\n    <${WRAPPER_ELEMENT_CONST} kind=${quote(kind)} {...props} />\n);`;
    }
    return [
        `export const ${flatName} = (props: ${propsType}): ReactNode => {`,
        `    const { ${slot.prop}, children, ...rest } = props;`,
        "    return (",
        `        <${WRAPPER_ELEMENT_CONST} kind=${quote(kind)} {...rest}>`,
        "            {children}",
        `            ${renderPositionalSlotChild(slot.kind, slot.prop)}`,
        `        </${WRAPPER_ELEMENT_CONST}>`,
        "    );",
        "};",
    ].join("\n");
};
