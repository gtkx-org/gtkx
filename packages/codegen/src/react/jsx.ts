import { sourceStringLiteral } from "@gtkx/utils";
import type { GirClass } from "../gir/class.js";
import type { Library } from "../gir/library.js";
import type { GirNamespace } from "../gir/namespace.js";
import type { JsxImports } from "./imports.js";
import {
    collectInterfacePropsClasses,
    collectIntrinsicElementClasses,
    type GlibNamedClass,
    interfaceGlibName,
    interfaceHasPropsBody,
    newlyImplementedInterfaces,
    type ResolvedQualifiedInterface,
} from "./intrinsic-elements.js";
import { buildElementPropsEntries, buildInterfacePropsEntries } from "./props.js";
import { ACCESSIBLE_ATTRIBUTES, SLOT_PROPS_BY_TYPE } from "./tables.js";

export type GenerateJsxOptions = {
    excludeNames: Set<string>;
    imports: JsxImports;
};

const QUALIFIED_TYPE_PATTERN = /^[A-Z][A-Za-z0-9]*\.[A-Z]/;

const ACCESSIBLE_INTERFACE_GLIB_NAME = "GtkAccessible";

export const generateJsxSection = (
    targetNamespace: GirNamespace,
    library: Library,
    options: GenerateJsxOptions,
): { source: string; intrinsicCount: number } => {
    const { excludeNames, imports } = options;
    const allWidgets = collectIntrinsicElementClasses(library);
    const widgets = allWidgets.filter((entry) => entry.namespace.name === targetNamespace.name);
    const intrinsicWidgets = widgets.filter((entry) => !excludeNames.has(entry.glibName));
    const constLines = intrinsicWidgets.map(
        (entry) => `export const ${entry.glibName} = ${sourceStringLiteral(entry.glibName)} as const;`,
    );

    const intrinsicElementByGlibName = new Map(allWidgets.map((entry) => [entry.glibName, entry]));
    const isIntrinsicElementAncestor = (candidate: GirClass): boolean => {
        const candidateGlib = candidate.glibTypeName ?? candidate.cType;
        return candidateGlib !== undefined && intrinsicElementByGlibName.has(candidateGlib);
    };
    imports.reactBuiltins.add("ReactNode");
    imports.reactBuiltins.add("Ref");

    let needsReactElement = false;
    const propBlocks: string[] = [];

    for (const iface of collectInterfacePropsClasses(library, targetNamespace.name)) {
        if (interfaceGlibName(iface.klass) === undefined) continue;
        const { block, slotPropNames } = renderInterfacePropsBlock(library, iface, targetNamespace.name, imports);
        if (slotPropNames.length > 0) needsReactElement = true;
        propBlocks.push(block);
    }

    const blockContext: RenderPropBlockContext = {
        isIntrinsicElementAncestor,
        intrinsicElementByGlibName,
        targetNamespaceName: targetNamespace.name,
        imports,
    };
    for (const entry of widgets) {
        const { block, slotPropNames } = renderPropBlock(library, entry, blockContext);
        if (slotPropNames.length > 0) needsReactElement = true;
        propBlocks.push(block);
    }
    if (needsReactElement) imports.reactBuiltins.add("ReactElement");

    const source = [constLines.join("\n"), "", propBlocks.join("\n\n"), "", renderJsxAugmentation(widgets)].join("\n");
    return { source, intrinsicCount: intrinsicWidgets.length };
};

const accessiblePropLines = (imports: JsxImports): string[] =>
    Object.entries(ACCESSIBLE_ATTRIBUTES).map(([name, { type }]) => {
        const namespace = type.split(".")[0];
        if (QUALIFIED_TYPE_PATTERN.test(type) && namespace !== undefined) {
            imports.giNamespaces.set(namespace, namespace);
        }
        return `    ${name}?: ${type} | null | undefined;`;
    });

const registerCrossNsProps = (
    imports: JsxImports,
    targetNamespaceName: string,
    namespaceName: string,
    propsName: string,
): void => {
    if (namespaceName === targetNamespaceName) return;
    const directory = namespaceName.toLowerCase();
    const names = imports.crossNsProps.get(directory) ?? new Set<string>();
    names.add(propsName);
    imports.crossNsProps.set(directory, names);
};

const interfacePropsRef = (
    iface: ResolvedQualifiedInterface,
    targetNamespaceName: string,
    imports: JsxImports,
): string | undefined => {
    const glib = interfaceGlibName(iface.klass);
    if (glib === undefined) return undefined;
    registerCrossNsProps(imports, targetNamespaceName, iface.namespace.name, `${glib}Props`);
    return `${glib}Props<Self>`;
};

const interfacePrerequisiteExtends = (
    library: Library,
    iface: ResolvedQualifiedInterface,
    targetNamespaceName: string,
    imports: JsxImports,
): string[] => {
    const refs: string[] = [];
    for (const prerequisiteName of iface.klass.prerequisites) {
        const resolved = library.resolveType(iface.namespace.name, prerequisiteName);
        if (resolved === undefined || resolved.kind !== "interface") continue;
        if (!interfaceHasPropsBody(resolved.value)) continue;
        const ref = interfacePropsRef(
            { klass: resolved.value, namespace: resolved.namespace },
            targetNamespaceName,
            imports,
        );
        if (ref !== undefined) refs.push(ref);
    }
    return refs;
};

const renderInterfacePropsBlock = (
    library: Library,
    iface: ResolvedQualifiedInterface,
    targetNamespaceName: string,
    imports: JsxImports,
): { block: string; slotPropNames: string[] } => {
    const glib = interfaceGlibName(iface.klass);
    const {
        propLines,
        imports: propImports,
        slotPropNames,
    } = buildInterfacePropsEntries({
        library,
        iface: iface.klass,
        namespace: iface.namespace,
    });
    for (const [namespace, alias] of propImports) imports.giNamespaces.set(namespace, alias);
    const ownerLines = propLines.map((line) => `    ${line}`);
    if (glib === ACCESSIBLE_INTERFACE_GLIB_NAME) ownerLines.push(...accessiblePropLines(imports));
    const prerequisiteExtends = interfacePrerequisiteExtends(library, iface, targetNamespaceName, imports);
    const extendsClause = prerequisiteExtends.length === 0 ? "" : ` extends ${prerequisiteExtends.join(", ")}`;
    const selfDefault = `${iface.namespace.name}.${iface.klass.name}`;
    const block = `export interface ${glib}Props<Self = ${selfDefault}>${extendsClause} {\n${ownerLines.join("\n")}\n}`;
    return { block, slotPropNames };
};

const renderJsxAugmentation = (widgets: GlibNamedClass[]): string =>
    [
        "declare global {",
        "    namespace React.JSX {",
        "        interface IntrinsicElements {",
        ...widgets.map((entry) => `        ${entry.glibName}: ${entry.glibName}Props;`),
        "        }",
        "    }",
        "}",
    ].join("\n");

type RenderPropBlockContext = {
    isIntrinsicElementAncestor: (candidate: GirClass) => boolean;
    intrinsicElementByGlibName: Map<string, GlibNamedClass>;
    targetNamespaceName: string;
    imports: JsxImports;
};

const renderPropBlock = (
    library: Library,
    entry: GlibNamedClass,
    context: RenderPropBlockContext,
): { block: string; slotPropNames: string[] } => {
    const slotProps = SLOT_PROPS_BY_TYPE[entry.glibName] ?? [];
    const { propLines, imports, slotPropNames } = buildElementPropsEntries({
        library,
        klass: entry.klass,
        namespace: entry.namespace,
        isIntrinsicElementAncestor: context.isIntrinsicElementAncestor,
    });
    for (const [namespace, alias] of imports) context.imports.giNamespaces.set(namespace, alias);
    context.imports.giNamespaces.set(entry.namespace.name, entry.namespace.name);
    const widgetTypeRef = `${entry.namespace.name}.${entry.klass.name} | null`;
    const slotPropLines = slotProps.map((propName) => `    ${propName}?: ReactNode | null | undefined;`);
    const ownerLines = [
        "    children?: ReactNode;",
        `    ref?: Ref<${widgetTypeRef}> | undefined;`,
        ...propLines.map((line) => `    ${line}`),
        ...slotPropLines,
    ];
    const extendsList = resolveWidgetExtends(library, entry, context);
    const extendsClause = extendsList.length === 0 ? "" : ` extends ${extendsList.join(", ")}`;
    const selfDefault = `${entry.namespace.name}.${entry.klass.name}`;
    const block = `export interface ${entry.glibName}Props<Self = ${selfDefault}>${extendsClause} {\n${ownerLines.join("\n")}\n}`;
    return { block, slotPropNames };
};

const resolveWidgetExtends = (library: Library, entry: GlibNamedClass, context: RenderPropBlockContext): string[] => {
    const extendsList: string[] = [];
    const parentRef = resolveParentPropsRef(library, entry, context);
    if (parentRef !== undefined) extendsList.push(parentRef);
    for (const iface of newlyImplementedInterfaces(entry.klass, entry.namespace, library)) {
        const ref = interfacePropsRef(iface, context.targetNamespaceName, context.imports);
        if (ref !== undefined) extendsList.push(ref);
    }
    return extendsList;
};

const resolveParentPropsRef = (
    library: Library,
    entry: GlibNamedClass,
    context: RenderPropBlockContext,
): string | undefined => {
    const parent = entry.klass.parent;
    if (parent === undefined) return undefined;
    const resolved = library.resolveType(entry.namespace.name, parent);
    if (resolved === undefined) return undefined;
    if (resolved.kind !== "class" && resolved.kind !== "interface") return undefined;
    const parentGlib = resolved.value.glibTypeName ?? resolved.value.cType;
    if (parentGlib === undefined) return undefined;
    if (!context.intrinsicElementByGlibName.has(parentGlib)) return undefined;
    registerCrossNsProps(context.imports, context.targetNamespaceName, resolved.namespace.name, `${parentGlib}Props`);
    return `${parentGlib}Props<Self>`;
};
