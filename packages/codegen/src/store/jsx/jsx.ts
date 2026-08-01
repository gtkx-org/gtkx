import { sourceStringLiteral } from "@gtkx/utils";
import type { GirClass } from "../../gir/class.js";
import type { Library } from "../../gir/library.js";
import type { GirNamespace } from "../../gir/namespace.js";
import type { ImportsBuilder } from "../../writer/imports.js";
import { renderJsDoc } from "../../writer/doc.js";
import { renderBlock } from "../../writer/emit.js";
import { elementPropTypeFor } from "./element-prop-imports.js";
import {
    collectInterfacePropsClasses,
    getGlibName,
    giNamespaceAlias,
    type GlibNamedClass,
    type HasContainerProps,
    hasInterfacePropsBody,
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

type InterfaceBlockContext = {
    library: Library;
    targetNamespaceName: string;
    imports: ImportsBuilder;
    hasContainerProps: HasContainerProps;
};

type RenderPropBlockContext = {
    isIntrinsicElementAncestor: (candidate: GirClass) => boolean;
    intrinsicElementByGlibName: Map<string, GlibNamedClass>;
    targetNamespaceName: string;
    imports: ImportsBuilder;
    hasContainerProps: (glibName: string | undefined) => boolean;
};

const ACCESSIBLE_INTERFACE_GLIB_NAME = "GtkAccessible";
const ACCESSIBLE_PROPS_NAME = "AccessibleProps";

const addGiNamespace = (imports: ImportsBuilder, namespaceName: string, alias: string): void => {
    if (namespaceName === "") {
        return;
    }

    imports.addNamespace(`@gtkx/gi/${namespaceName.toLowerCase()}`, alias, true);
};

const addReactBuiltin = (imports: ImportsBuilder, name: string): void => {
    imports.addNamed("react", name, true);
};

const propLineName = (line: string): string | undefined => {
    const declaration = line.slice(line.lastIndexOf("\n") + 1);
    const name = declaration.split(/[?:]/, 1)[0]?.trim();

    return name === undefined || name === "" ? undefined : name;
};

const acceptPropLine = (line: string, seen: Set<string>, result: string[]): void => {
    const name = propLineName(line);

    if (name !== undefined && seen.has(name)) {
        return;
    }

    if (name !== undefined) {
        seen.add(name);
    }

    result.push(line);
};

const dedupePropLines = (lines: string[]): string[] => {
    const seen: Set<string> = new Set();
    const result: string[] = [];

    for (const line of lines) {
        acceptPropLine(line, seen, result);
    }

    return result;
};

const generateJsxSection = (
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
        const candidateGlib = getGlibName(candidate);

        return candidateGlib !== undefined && intrinsicElementByGlibName.has(candidateGlib);
    };

    addReactBuiltin(imports, "ReactNode");
    addReactBuiltin(imports, "Ref");
    const interfaceResult = renderInterfacePropBlocks(library, targetNamespace.name, options);
    let requiresReactElement = interfaceResult.requiresReactElement;
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

        if (objectPropNames.length > 0) {
            requiresReactElement = true;
        }

        propBlocks.push(block);
    }

    if (requiresReactElement) {
        addReactBuiltin(imports, "ReactElement");
    }

    const source = [
        constLines.join("\n"),
        "",
        propBlocks.join("\n\n"),
        "",
        renderJsxAugmentation(namespaceElements),
    ].join("\n");

    return { source, intrinsicCount: intrinsicElementConsts.length };
};

const hasContainerProps: HasContainerProps = (glibName) =>
    glibName !== undefined && elementPropTypeFor(glibName) !== undefined;

const renderInterfacePropBlocks = (
    library: Library,
    targetNamespaceName: string,
    options: GenerateJsxOptions,
): { blocks: string[]; requiresReactElement: boolean; hasContainerProps: HasContainerProps } => {
    const { imports, intrinsicElements } = options;
    const context: InterfaceBlockContext = { library, targetNamespaceName, imports, hasContainerProps };
    const blocks: string[] = [];
    let requiresReactElement = false;

    for (const iface of collectInterfacePropsClasses(
        library,
        intrinsicElements,
        targetNamespaceName,
        hasContainerProps,
    )) {
        const glibName = getGlibName(iface.klass);

        if (glibName === undefined) {
            continue;
        }

        const { block, objectPropNames } = renderInterfacePropsBlock(iface, glibName, context);

        if (objectPropNames.length > 0) {
            requiresReactElement = true;
        }

        blocks.push(block);
    }

    return { blocks, requiresReactElement, hasContainerProps };
};

const registerCrossNsProps = (
    imports: ImportsBuilder,
    targetNamespaceName: string,
    namespaceName: string,
    propsName: string,
): void => {
    if (namespaceName === targetNamespaceName) {
        return;
    }

    const ns = namespaceName.toLowerCase();
    imports.addNamed(`../${ns}/${ns}.js`, propsName, true);
};

const interfacePropsRef = (
    iface: ResolvedQualifiedInterface,
    targetNamespaceName: string,
    imports: ImportsBuilder,
): string | undefined => {
    const glib = getGlibName(iface.klass);

    if (glib === undefined) {
        return undefined;
    }

    registerCrossNsProps(imports, targetNamespaceName, iface.namespace.name, `${glib}Props`);

    return `${glib}Props<Self>`;
};

const prerequisiteExtendRef = (
    prerequisiteName: string,
    iface: ResolvedQualifiedInterface,
    context: InterfaceBlockContext,
): string | undefined => {
    const { library, targetNamespaceName, imports, hasContainerProps } = context;
    const resolved = library.resolveType(iface.namespace.name, prerequisiteName);

    if (resolved?.kind !== "interface") {
        return undefined;
    }

    if (!hasInterfacePropsBody(resolved.value, hasContainerProps)) {
        return undefined;
    }

    return interfacePropsRef({ klass: resolved.value, namespace: resolved.namespace }, targetNamespaceName, imports);
};

const interfacePrerequisiteExtends = (iface: ResolvedQualifiedInterface, context: InterfaceBlockContext): string[] => {
    const refs: string[] = [];

    for (const prerequisiteName of iface.klass.prerequisites) {
        const ref = prerequisiteExtendRef(prerequisiteName, iface, context);

        if (ref !== undefined) {
            refs.push(ref);
        }
    }

    return refs;
};

const renderInterfacePropsBlock = (
    iface: ResolvedQualifiedInterface,
    glib: string,
    context: InterfaceBlockContext,
): { block: string; objectPropNames: string[] } => {
    const { library, imports } = context;

    const {
        propLines,
        imports: propImports,
        objectPropNames,
    } = buildInterfacePropsEntries({
        library,
        iface: iface.klass,
        namespace: iface.namespace,
    });

    for (const [namespace, alias] of propImports) {
        addGiNamespace(imports, namespace, alias);
    }

    const ownerLines = dedupePropLines(propLines);
    const prerequisiteExtends = interfacePrerequisiteExtends(iface, context);
    const declared = elementPropTypeFor(glib);

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
    const signature = `export interface ${glib}Props<Self = ${selfDefault}>${extendsClause}`;
    const block = `${renderJsDoc(iface.klass.doc)}${renderBlock(signature, ownerLines.join("\n"))}`;

    return { block, objectPropNames };
};

const renderJsxAugmentation = (namespaceElements: GlibNamedClass[]): string => {
    const elementLines = namespaceElements
        .filter((entry) => !entry.klass.isAbstract)
        .map((entry) => `${entry.glibName}: ${entry.glibName}Props;`)
        .join("\n");

    const intrinsicInterface = renderBlock("interface IntrinsicElements", elementLines);
    const reactJsxNamespace = renderBlock("namespace React.JSX", intrinsicInterface);

    return renderBlock("declare global", reactJsxNamespace);
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

    for (const [namespace, alias] of imports) {
        addGiNamespace(context.imports, namespace, alias);
    }

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

    if (parentRef !== undefined) {
        extendsList.push(parentRef);
    }

    for (const iface of newlyImplementedInterfaces(entry.klass, entry.namespace, library, context.hasContainerProps)) {
        const ref = interfacePropsRef(iface, context.targetNamespaceName, context.imports);

        if (ref !== undefined) {
            extendsList.push(ref);
        }
    }

    return extendsList;
};

const resolveParentClassLike = (library: Library, namespaceName: string, parent: string) => {
    const resolved = library.resolveType(namespaceName, parent);

    if (resolved === undefined) {
        return;
    }

    if (resolved.kind !== "class" && resolved.kind !== "interface") {
        return;
    }

    return resolved;
};

const resolveParentPropsRef = (
    library: Library,
    entry: GlibNamedClass,
    context: RenderPropBlockContext,
): string | undefined => {
    const parent = entry.klass.parent;

    if (parent === undefined) {
        return undefined;
    }

    const resolved = resolveParentClassLike(library, entry.namespace.name, parent);

    if (resolved === undefined) {
        return undefined;
    }

    const parentGlib = getGlibName(resolved.value);

    if (parentGlib === undefined) {
        return undefined;
    }

    if (!context.intrinsicElementByGlibName.has(parentGlib)) {
        return undefined;
    }

    registerCrossNsProps(context.imports, context.targetNamespaceName, resolved.namespace.name, `${parentGlib}Props`);

    return `${parentGlib}Props<Self>`;
};

export { generateJsxSection };
