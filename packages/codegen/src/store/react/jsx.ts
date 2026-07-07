import { sourceStringLiteral } from "@gtkx/utils";
import type { GirClass } from "../../gir/class.js";
import type { Library } from "../../gir/library.js";
import type { GirNamespace } from "../../gir/namespace.js";
import { renderBlock } from "../../writer/emit.js";
import type { ImportsBuilder } from "../../writer/imports.js";
import type { ElementPropTypegen } from "./element-prop-types.js";
import {
    collectInterfacePropsClasses,
    type GlibNamedClass,
    glibNameOf,
    interfaceHasPropsBody,
    newlyImplementedInterfaces,
    type ResolvedQualifiedInterface,
} from "./intrinsic-elements.js";
import { buildElementPropsEntries, buildInterfacePropsEntries } from "./props.js";
import { ACCESSIBLE_ATTRIBUTES } from "./tables.js";

type GenerateJsxOptions = {
    excludeNames: Set<string>;
    imports: ImportsBuilder;
    typegen: ElementPropTypegen;
    intrinsicElements: GlibNamedClass[];
    intrinsicElementByGlibName: Map<string, GlibNamedClass>;
};

const QUALIFIED_TYPE_PATTERN = /^[A-Z][A-Za-z0-9]*\.[A-Z]/;

const ACCESSIBLE_INTERFACE_GLIB_NAME = "GtkAccessible";

const addGiNamespace = (imports: ImportsBuilder, namespaceName: string, alias: string): void => {
    if (namespaceName === "") return;
    imports.addNamespace(`@gtkx/gi/${namespaceName.toLowerCase()}`, alias, true);
};

const addReactBuiltin = (imports: ImportsBuilder, name: string): void => {
    imports.addNamed("react", name, true);
};

export const generateJsxSection = (
    targetNamespace: GirNamespace,
    library: Library,
    options: GenerateJsxOptions,
): { source: string; intrinsicCount: number } => {
    const { excludeNames, imports, typegen, intrinsicElements, intrinsicElementByGlibName } = options;
    const widgets = intrinsicElements.filter((entry) => entry.namespace.name === targetNamespace.name);
    const intrinsicWidgets = widgets.filter((entry) => !excludeNames.has(entry.glibName));
    const constLines = intrinsicWidgets.map(
        (entry) => `export const ${entry.glibName} = ${sourceStringLiteral(entry.glibName)} as const;`,
    );

    const isIntrinsicElementAncestor = (candidate: GirClass): boolean => {
        const candidateGlib = glibNameOf(candidate);
        return candidateGlib !== undefined && intrinsicElementByGlibName.has(candidateGlib);
    };
    addReactBuiltin(imports, "ReactNode");
    addReactBuiltin(imports, "Ref");

    let needsReactElement = false;
    const propBlocks: string[] = [];

    for (const iface of collectInterfacePropsClasses(library, intrinsicElements, targetNamespace.name)) {
        if (glibNameOf(iface.klass) === undefined) continue;
        const { block, slotPropNames } = renderInterfacePropsBlock(library, iface, targetNamespace.name, imports);
        if (slotPropNames.length > 0) needsReactElement = true;
        propBlocks.push(block);
    }

    const blockContext: RenderPropBlockContext = {
        isIntrinsicElementAncestor,
        intrinsicElementByGlibName,
        targetNamespaceName: targetNamespace.name,
        imports,
        typegen,
    };
    for (const entry of widgets) {
        const { block, slotPropNames } = renderPropBlock(library, entry, blockContext);
        if (slotPropNames.length > 0) needsReactElement = true;
        propBlocks.push(block);
    }
    if (needsReactElement) addReactBuiltin(imports, "ReactElement");

    const source = [constLines.join("\n"), "", propBlocks.join("\n\n"), "", renderJsxAugmentation(widgets)].join("\n");
    return { source, intrinsicCount: intrinsicWidgets.length };
};

const accessiblePropLines = (imports: ImportsBuilder): string[] =>
    Object.entries(ACCESSIBLE_ATTRIBUTES).map(([name, { type }]) => {
        const namespace = type.split(".")[0];
        if (QUALIFIED_TYPE_PATTERN.test(type) && namespace !== undefined) {
            addGiNamespace(imports, namespace, namespace);
        }
        return `${name}?: ${type} | null | undefined;`;
    });

const registerCrossNsProps = (
    imports: ImportsBuilder,
    targetNamespaceName: string,
    namespaceName: string,
    propsName: string,
): void => {
    if (namespaceName === targetNamespaceName) return;
    imports.addNamed(`@gtkx/jsx/${namespaceName.toLowerCase()}`, propsName, true);
};

const interfacePropsRef = (
    iface: ResolvedQualifiedInterface,
    targetNamespaceName: string,
    imports: ImportsBuilder,
): string | undefined => {
    const glib = glibNameOf(iface.klass);
    if (glib === undefined) return undefined;
    registerCrossNsProps(imports, targetNamespaceName, iface.namespace.name, `${glib}Props`);
    return `${glib}Props<Self>`;
};

const interfacePrerequisiteExtends = (
    library: Library,
    iface: ResolvedQualifiedInterface,
    targetNamespaceName: string,
    imports: ImportsBuilder,
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
    imports: ImportsBuilder,
): { block: string; slotPropNames: string[] } => {
    const glib = glibNameOf(iface.klass);
    const {
        propLines,
        imports: propImports,
        slotPropNames,
    } = buildInterfacePropsEntries({
        library,
        iface: iface.klass,
        namespace: iface.namespace,
    });
    for (const [namespace, alias] of propImports) addGiNamespace(imports, namespace, alias);
    const ownerLines = [...propLines];
    if (glib === ACCESSIBLE_INTERFACE_GLIB_NAME) ownerLines.push(...accessiblePropLines(imports));
    const prerequisiteExtends = interfacePrerequisiteExtends(library, iface, targetNamespaceName, imports);
    const extendsClause = prerequisiteExtends.length === 0 ? "" : ` extends ${prerequisiteExtends.join(", ")}`;
    const selfDefault = `${iface.namespace.name}.${iface.klass.name}`;
    const block = renderBlock(
        `export interface ${glib}Props<Self = ${selfDefault}>${extendsClause}`,
        ownerLines.join("\n"),
    );
    return { block, slotPropNames };
};

const renderJsxAugmentation = (widgets: GlibNamedClass[]): string => {
    const elementLines = widgets.map((entry) => `${entry.glibName}: ${entry.glibName}Props;`).join("\n");
    const intrinsicInterface = renderBlock("interface IntrinsicElements", elementLines);
    const reactJsxNamespace = renderBlock("namespace React.JSX", intrinsicInterface);
    return renderBlock("declare global", reactJsxNamespace);
};

type RenderPropBlockContext = {
    isIntrinsicElementAncestor: (candidate: GirClass) => boolean;
    intrinsicElementByGlibName: Map<string, GlibNamedClass>;
    targetNamespaceName: string;
    imports: ImportsBuilder;
    typegen: ElementPropTypegen;
};

const renderPropBlock = (
    library: Library,
    entry: GlibNamedClass,
    context: RenderPropBlockContext,
): { block: string; slotPropNames: string[] } => {
    const slotProps = context.typegen.slotNamesFor(entry.glibName);
    const { propLines, imports, slotPropNames } = buildElementPropsEntries({
        library,
        klass: entry.klass,
        namespace: entry.namespace,
        isIntrinsicElementAncestor: context.isIntrinsicElementAncestor,
    });
    for (const [namespace, alias] of imports) addGiNamespace(context.imports, namespace, alias);
    addGiNamespace(context.imports, entry.namespace.name, entry.namespace.name);
    const elementPropImports = new Map<string, string>();
    const elementPropLines = context.typegen.classPropLines(
        entry.glibName,
        entry.klass,
        entry.namespace,
        elementPropImports,
    );
    for (const [namespace, alias] of elementPropImports) addGiNamespace(context.imports, namespace, alias);
    const widgetTypeRef = `${entry.namespace.name}.${entry.klass.name} | null`;
    const slotPropLines = slotProps.map((propName) => `${propName}?: ReactNode | null | undefined;`);
    const ownerLines = [
        ...(context.typegen.acceptsChildren(entry.glibName) ? ["children?: ReactNode;"] : []),
        `ref?: Ref<${widgetTypeRef}> | undefined;`,
        ...propLines,
        ...slotPropLines,
        ...elementPropLines,
    ];
    const extendsList = resolveWidgetExtends(library, entry, context);
    const extendsClause = extendsList.length === 0 ? "" : ` extends ${extendsList.join(", ")}`;
    const selfDefault = `${entry.namespace.name}.${entry.klass.name}`;
    const block = renderBlock(
        `export interface ${entry.glibName}Props<Self = ${selfDefault}>${extendsClause}`,
        ownerLines.join("\n"),
    );
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
    const parentGlib = glibNameOf(resolved.value);
    if (parentGlib === undefined) return undefined;
    if (!context.intrinsicElementByGlibName.has(parentGlib)) return undefined;
    registerCrossNsProps(context.imports, context.targetNamespaceName, resolved.namespace.name, `${parentGlib}Props`);
    return `${parentGlib}Props<Self>`;
};
