import { sourceStringLiteral } from "@gtkx/utils";
import type { GirClass } from "../../gir/class.js";
import type { Library } from "../../gir/library.js";
import type { GirNamespace } from "../../gir/namespace.js";
import { renderJsDoc } from "../../writer/doc.js";
import { renderBlock } from "../../writer/emit.js";
import type { ImportsBuilder } from "../../writer/imports.js";
import { elementPropTypeFor } from "./element-prop-imports.js";
import {
    collectInterfacePropsClasses,
    type GlibNamedClass,
    giNamespaceAlias,
    glibNameOf,
    type HasContainerProps,
    interfaceHasPropsBody,
    newlyImplementedInterfaces,
    type ResolvedQualifiedInterface,
} from "./intrinsic-elements.js";
import { buildElementPropsEntries, buildInterfacePropsEntries } from "./props.js";

type GenerateJsxOptions = {
    excludeNames: Set<string>;
    imports: ImportsBuilder;
    intrinsicElements: GlibNamedClass[];
    intrinsicElementByGlibName: Map<string, GlibNamedClass>;
};

const ACCESSIBLE_INTERFACE_GLIB_NAME = "GtkAccessible";

const ACCESSIBLE_PROPS_NAME = "AccessibleProps";

const addGiNamespace = (imports: ImportsBuilder, namespaceName: string, alias: string): void => {
    if (namespaceName === "") return;
    imports.addNamespace(`@gtkx/gi/${namespaceName.toLowerCase()}`, alias, true);
};

const addReactBuiltin = (imports: ImportsBuilder, name: string): void => {
    imports.addNamed("react", name, true);
};

const propLineName = (line: string): string | undefined => {
    const declaration = line.slice(line.lastIndexOf("\n") + 1);
    return declaration.split(/[?:]/, 1)[0]?.trim() || undefined;
};

const dedupePropLines = (lines: string[]): string[] => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const line of lines) {
        const name = propLineName(line);
        if (name !== undefined && seen.has(name)) continue;
        if (name !== undefined) seen.add(name);
        result.push(line);
    }
    return result;
};

export const generateJsxSection = (
    targetNamespace: GirNamespace,
    library: Library,
    options: GenerateJsxOptions,
): { source: string; intrinsicCount: number } => {
    const { excludeNames, imports, intrinsicElements, intrinsicElementByGlibName } = options;
    const namespaceElements = intrinsicElements.filter((entry) => entry.namespace.name === targetNamespace.name);
    const intrinsicElementConsts = namespaceElements.filter((entry) => !excludeNames.has(entry.glibName));
    const constLines = intrinsicElementConsts.map(
        (entry) => `export const ${entry.glibName} = ${sourceStringLiteral(entry.glibName)} as const;`,
    );

    const isIntrinsicElementAncestor = (candidate: GirClass): boolean => {
        const candidateGlib = glibNameOf(candidate);
        return candidateGlib !== undefined && intrinsicElementByGlibName.has(candidateGlib);
    };
    addReactBuiltin(imports, "ReactNode");
    addReactBuiltin(imports, "Ref");

    const interfaceResult = renderInterfacePropBlocks(library, targetNamespace.name, options);
    let needsReactElement = interfaceResult.needsReactElement;
    const propBlocks: string[] = [...interfaceResult.blocks];

    const blockContext: RenderPropBlockContext = {
        isIntrinsicElementAncestor,
        intrinsicElementByGlibName,
        targetNamespaceName: targetNamespace.name,
        imports,
        hasContainerProps: interfaceResult.hasContainerProps,
    };
    for (const entry of namespaceElements) {
        const { block, objectPropNames } = renderPropBlock(library, entry, blockContext);
        if (objectPropNames.length > 0) needsReactElement = true;
        propBlocks.push(block);
    }
    if (needsReactElement) addReactBuiltin(imports, "ReactElement");

    const source = [
        constLines.join("\n"),
        "",
        propBlocks.join("\n\n"),
        "",
        renderJsxAugmentation(namespaceElements),
    ].join("\n");
    return { source, intrinsicCount: intrinsicElementConsts.length };
};

type InterfaceBlockContext = {
    library: Library;
    targetNamespaceName: string;
    imports: ImportsBuilder;
    hasContainerProps: HasContainerProps;
};

const renderInterfacePropBlocks = (
    library: Library,
    targetNamespaceName: string,
    options: GenerateJsxOptions,
): { blocks: string[]; needsReactElement: boolean; hasContainerProps: HasContainerProps } => {
    const { imports, intrinsicElements } = options;
    const hasContainerProps: HasContainerProps = (glibName) =>
        glibName !== undefined && elementPropTypeFor(glibName) !== undefined;
    const context: InterfaceBlockContext = { library, targetNamespaceName, imports, hasContainerProps };
    const blocks: string[] = [];
    let needsReactElement = false;
    for (const iface of collectInterfacePropsClasses(
        library,
        intrinsicElements,
        targetNamespaceName,
        hasContainerProps,
    )) {
        if (glibNameOf(iface.klass) === undefined) continue;
        const { block, objectPropNames } = renderInterfacePropsBlock(iface, context);
        if (objectPropNames.length > 0) needsReactElement = true;
        blocks.push(block);
    }
    return { blocks, needsReactElement, hasContainerProps };
};

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

const interfacePrerequisiteExtends = (iface: ResolvedQualifiedInterface, context: InterfaceBlockContext): string[] => {
    const { library, targetNamespaceName, imports, hasContainerProps } = context;
    const refs: string[] = [];
    for (const prerequisiteName of iface.klass.prerequisites) {
        const resolved = library.resolveType(iface.namespace.name, prerequisiteName);
        if (resolved === undefined || resolved.kind !== "interface") continue;
        if (!interfaceHasPropsBody(resolved.value, hasContainerProps)) continue;
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
    iface: ResolvedQualifiedInterface,
    context: InterfaceBlockContext,
): { block: string; objectPropNames: string[] } => {
    const { library, imports } = context;
    const glib = glibNameOf(iface.klass);
    const {
        propLines,
        imports: propImports,
        objectPropNames,
    } = buildInterfacePropsEntries({
        library,
        iface: iface.klass,
        namespace: iface.namespace,
    });
    for (const [namespace, alias] of propImports) addGiNamespace(imports, namespace, alias);
    const ownerLines = dedupePropLines(propLines);
    const prerequisiteExtends = interfacePrerequisiteExtends(iface, context);
    const declared = glib === undefined ? undefined : elementPropTypeFor(glib);
    if (declared !== undefined) {
        const alias = `${declared.export}Base`;
        imports.addNamed(declared.module, declared.export, true, alias);
        prerequisiteExtends.push(alias);
    }

    if (glib === ACCESSIBLE_INTERFACE_GLIB_NAME) {
        imports.addNamed("@gtkx/react", ACCESSIBLE_PROPS_NAME, true);
        prerequisiteExtends.push(ACCESSIBLE_PROPS_NAME);
    }
    const extendsClause = prerequisiteExtends.length === 0 ? "" : ` extends ${prerequisiteExtends.join(", ")}`;
    addGiNamespace(imports, iface.namespace.name, giNamespaceAlias(iface.namespace.name));
    const selfDefault = `${giNamespaceAlias(iface.namespace.name)}.${iface.klass.name}`;
    const block = `${renderJsDoc(iface.klass.doc)}${renderBlock(
        `export interface ${glib}Props<Self = ${selfDefault}>${extendsClause}`,
        ownerLines.join("\n"),
    )}`;
    return { block, objectPropNames };
};

const renderJsxAugmentation = (namespaceElements: GlibNamedClass[]): string => {
    const elementLines = namespaceElements.map((entry) => `${entry.glibName}: ${entry.glibName}Props;`).join("\n");
    const intrinsicInterface = renderBlock("interface IntrinsicElements", elementLines);
    const reactJsxNamespace = renderBlock("namespace React.JSX", intrinsicInterface);
    return renderBlock("declare global", reactJsxNamespace);
};

type RenderPropBlockContext = {
    isIntrinsicElementAncestor: (candidate: GirClass) => boolean;
    intrinsicElementByGlibName: Map<string, GlibNamedClass>;
    targetNamespaceName: string;
    imports: ImportsBuilder;
    hasContainerProps: (glibName: string | undefined) => boolean;
};

const renderPropBlock = (
    library: Library,
    entry: GlibNamedClass,
    context: RenderPropBlockContext,
): { block: string; objectPropNames: string[] } => {
    const { propLines, imports, objectPropNames } = buildElementPropsEntries({
        library,
        klass: entry.klass,
        namespace: entry.namespace,
        isIntrinsicElementAncestor: context.isIntrinsicElementAncestor,
    });
    for (const [namespace, alias] of imports) addGiNamespace(context.imports, namespace, alias);
    addGiNamespace(context.imports, entry.namespace.name, giNamespaceAlias(entry.namespace.name));
    const ownerLines = dedupePropLines(["ref?: Ref<Self | null> | undefined;", ...propLines]);
    const extendsList = resolveElementExtends(library, entry, context);
    const extendsClause = extendsList.length === 0 ? "" : ` extends ${extendsList.join(", ")}`;
    const selfDefault = `${giNamespaceAlias(entry.namespace.name)}.${entry.klass.name}`;
    const block = `${renderJsDoc(entry.klass.doc)}${renderBlock(
        `export interface ${entry.glibName}Props<Self = ${selfDefault}>${extendsClause}`,
        ownerLines.join("\n"),
    )}`;
    return { block, objectPropNames };
};

const resolveElementExtends = (library: Library, entry: GlibNamedClass, context: RenderPropBlockContext): string[] => {
    const extendsList: string[] = [];
    const declared = elementPropTypeFor(entry.glibName);
    if (declared !== undefined) {
        const alias = `${declared.export}Base`;
        context.imports.addNamed(declared.module, declared.export, true, alias);
        extendsList.push(alias);
    }
    const parentRef = resolveParentPropsRef(library, entry, context);
    if (parentRef !== undefined) extendsList.push(parentRef);
    for (const iface of newlyImplementedInterfaces(entry.klass, entry.namespace, library, context.hasContainerProps)) {
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
