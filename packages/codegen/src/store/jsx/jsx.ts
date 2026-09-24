import { sanitizeTypeIdentifier, sourceStringLiteral } from "@gtkx/utils";
import type { GirClass } from "../../gir/class.js";
import type { Library } from "../../gir/library.js";
import type { GirNamespace } from "../../gir/namespace.js";
import type { ImportsBuilder } from "../../writer/imports.js";
import type { GirIndex } from "./gir-index.js";
import { externalPackageFor } from "../../gir/external-namespaces.js";
import { renderBlock } from "../../writer/emit.js";
import { getDoc } from "../gi/doc-spec.js";
import {
    constructOnlyPropNames,
    namedPropsConstructOnlyPropNames,
    renderConstructOnlyUnion,
    renderGeneratedElementProps,
} from "./element-construct-only.js";
import {
    elementBasePropTypeFor,
    elementPropTypeFor,
    factoryElementPropTypeFor,
    inheritablePropsNameFor,
} from "./element-prop-imports.js";
import { isMountableElement } from "./generated-elements.js";
import {
    ancestorGlibNames,
    collectInterfacePropsClasses,
    getGlibName,
    giNamespaceAlias,
    type GlibNamedClass,
    type HasContainerProps,
    hasInterfacePropsBody,
    newlyImplementedInterfaces,
    type ResolvedQualifiedInterface,
} from "./intrinsic-elements.js";
import { omittedPropKeysFor } from "./omitted-props.js";
import { buildElementPropsEntries, buildInterfacePropsEntries } from "./props.js";

type GenerateJsxOptions = {
    excludeNames: Set<string>;
    imports: ImportsBuilder;
    intrinsicElements: GlibNamedClass[];
    intrinsicElementByGlibName: Map<string, GlibNamedClass>;
    girIndex: GirIndex;
};

type InterfaceBlockContext = {
    library: Library;
    targetNamespaceName: string;
    imports: ImportsBuilder;
    hasContainerProps: HasContainerProps;
};

type RenderPropBlockContext = {
    girIndex: GirIndex;
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

    const specifier = externalPackageFor(namespaceName) ?? `@gtkx/gi/${namespaceName.toLowerCase()}`;
    imports.addNamespace(specifier, alias, true);
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
        (entry) =>
            `${getDoc(entry.klass)}export const ${entry.glibName} = ` +
            `${sourceStringLiteral(entry.glibName)} as const;`,
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
        girIndex: options.girIndex,
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
        constLines.join("\n\n"),
        "",
        propBlocks.join("\n\n"),
        "",
        renderJsxAugmentation(namespaceElements),
    ].join("\n");

    return { source, intrinsicCount: intrinsicElementConsts.length };
};

const hasContainerProps: HasContainerProps = (glibName) =>
    glibName !== undefined && elementBasePropTypeFor(glibName) !== undefined;

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

const hasIntersectionProps = (klass: GirClass, namespace: GirNamespace, library: Library): boolean =>
    ancestorGlibNames(klass, namespace, library)
        .some((name) => elementPropTypeFor(name)?.composition === "intersection");

const renderPropsDeclaration = (name: string, parents: string[], body: string, isIntersection: boolean): string => {
    if (isIntersection) {
        const bases = parents.length === 0 ? "" : `${parents.join(" & ")} & `;

        const signature = `export type ${name} = ${bases}`;

        return `${renderBlock(signature, body)};`;
    }

    const bases = parents.length === 0 ? "" : ` extends ${parents.join(", ")}`;

    return renderBlock(`export interface ${name}${bases}`, body);
};

const omitInheritedProps = (parents: string[], glibName: string, imports: ImportsBuilder): string[] => {
    const omitted = omittedPropKeysFor(glibName);

    if (omitted.length === 0 || parents.length === 0) {
        return parents;
    }

    imports.addNamed("@gtkx/react/internal", "DistributedOmit", true);
    const keys = omitted.map((name) => sourceStringLiteral(name)).join(" | ");

    return parents.map((parent) => `DistributedOmit<${parent}, (${keys}) & keyof ${parent}>`);
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
    const prerequisiteExtends = omitInheritedProps(interfacePrerequisiteExtends(iface, context), glib, imports);
    const declared = elementBasePropTypeFor(glib);

    if (declared !== undefined) {
        const alias = `${declared.export}Base`;
        imports.addNamed(declared.module, declared.export, true, alias);
        prerequisiteExtends.push(alias);
    }

    if (glib === ACCESSIBLE_INTERFACE_GLIB_NAME) {
        imports.addNamed("@gtkx/react", ACCESSIBLE_PROPS_NAME, true);
        prerequisiteExtends.push(ACCESSIBLE_PROPS_NAME);
    }

    addGiNamespace(imports, iface.namespace.name, giNamespaceAlias(iface.namespace.name));
    const selfDefault = `${giNamespaceAlias(iface.namespace.name)}.${sanitizeTypeIdentifier(iface.klass.name)}`;
    const block = `${getDoc(iface.klass)}${renderPropsDeclaration(
        `${glib}Props<Self = ${selfDefault}>`,
        prerequisiteExtends,
        ownerLines.join("\n"),
        hasIntersectionProps(iface.klass, iface.namespace, library),
    )}`;

    return { block, objectPropNames };
};

const renderJsxAugmentation = (
    namespaceElements: GlibNamedClass[],
): string => {
    const elementLines = namespaceElements
        .filter(isMountableElement)
        .map((entry) => `${getDoc(entry.klass)}${entry.glibName}: ${entry.glibName}Props;`)
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
    const constructOnly = namedPropsConstructOnlyPropNames(context.girIndex, entry);

    if (constructOnly.length > 0) {
        context.imports.addNamed("@gtkx/react/internal", "ConstructOnlyMetadata", true);
        context.imports.addNamed("@gtkx/react/internal", "constructOnlyProps", true);
        ownerLines.push(
            `readonly [constructOnlyProps]?: ConstructOnlyMetadata<${renderConstructOnlyUnion(constructOnly)}>;`,
        );
    }

    const extendsList = resolveElementExtends(library, entry, context);
    const selfDefault = `${giNamespaceAlias(entry.namespace.name)}.${sanitizeTypeIdentifier(entry.klass.name)}`;

    const inherited = renderPropsDeclaration(
        `${inheritablePropsNameFor(entry.glibName)}<Self = ${selfDefault}>`,
        extendsList,
        ownerLines.join("\n"),
        hasIntersectionProps(entry.klass, entry.namespace, library),
    );
    const block = renderNamedProps(entry, inherited, selfDefault, context);

    return { block, objectPropNames };
};

const renderNamedProps = (
    entry: GlibNamedClass,
    inherited: string,
    selfDefault: string,
    context: RenderPropBlockContext,
): string => {
    const factory = factoryElementPropTypeFor(entry.glibName);
    const doc = getDoc(entry.klass);

    if (factory === undefined) {
        return `${doc}${inherited}`;
    }

    context.imports.addNamed(factory.module, factory.export, true);
    const props = `${inheritablePropsNameFor(entry.glibName)}<Self> & ${factory.export}`;
    const constructOnly = constructOnlyPropNames(context.girIndex, entry);

    if (constructOnly.length > 0) {
        context.imports.addNamed("@gtkx/react/internal", "GeneratedElementProps", true);
    }

    const signature = `export type ${entry.glibName}Props<Self = ${selfDefault}>`;

    return `${inherited}\n\n${doc}${signature} = ${renderGeneratedElementProps(props, constructOnly)};`;
};

const resolveElementExtends = (library: Library, entry: GlibNamedClass, context: RenderPropBlockContext): string[] => {
    const extendsList: string[] = [];
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

    const inherited = omitInheritedProps(extendsList, entry.glibName, context.imports);
    const declared = elementBasePropTypeFor(entry.glibName);

    if (declared !== undefined) {
        const alias = `${declared.export}Base`;
        context.imports.addNamed(declared.module, declared.export, true, alias);
        inherited.unshift(alias);
    }

    return inherited;
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

    const propsName = inheritablePropsNameFor(parentGlib);
    registerCrossNsProps(context.imports, context.targetNamespaceName, resolved.namespace.name, propsName);

    return `${propsName}<Self>`;
};

export { generateJsxSection };
