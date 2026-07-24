import type { AppliedProp, BuildArg, Call, ContainerProp, ElementProp, ListProp } from "@gtkx/config";
import { toCamelIdentifier, upperFirst } from "@gtkx/utils";
import { renderBaseTypeFor } from "../../analysis/ts-type.js";
import type { GirClass } from "../../gir/class.js";
import type { GirNamespace } from "../../gir/namespace.js";
import type { GirParameter } from "../../gir/parameter.js";
import { chainOf, findMethod, type GirIndex, type GirTypeEntry, hasProperty } from "./gir-index.js";
import { glibNameOf } from "./intrinsic-elements.js";
import { addCalls, buildArgsOf, isBuildArg } from "./list-calls.js";
import { reactTarget } from "./props.js";

type TypeImports = Map<string, string>;

/**
 * Import sinks a prop-line render writes into: `gi` maps a GIR namespace to its
 * module alias, `jsx` maps a generated type name to the namespace exporting it.
 */
export type ElementPropImports = { gi: TypeImports; jsx: Map<string, string> };

type PropContribution = {
    child: string;
    prop: string;
    param: GirParameter;
};

export type LazyElementSpec = {
    element: string;
    typeName: string;
    typeSource: string;
};

export type ElementPropTypegen = {
    classPropLines: (
        glibName: string,
        klass: GirClass,
        namespace: GirNamespace,
        imports: ElementPropImports,
    ) => string[];
    lazyElementExports: (namespaceName: string) => LazyElementSpec[];
    listItemTypeSources: (namespaceName: string, imports: ElementPropImports) => string[];
    containerPropNamesFor: (glibName: string) => string[];
    acceptsChildren: (glibName: string) => boolean;
};

export const emptyElementPropImports = (): ElementPropImports => ({ gi: new Map(), jsx: new Map() });

const forEachContainer = (
    elementProps: Record<string, ElementProp[]>,
    visit: (type: string, prop: ContainerProp) => void,
): void => {
    for (const [type, props] of Object.entries(elementProps)) {
        for (const prop of props) {
            if (prop.kind === "container") visit(type, prop);
        }
    }
};

const renderParamType = (context: GirIndex, imports: TypeImports, param: GirParameter | undefined): string => {
    if (param === undefined) return "unknown";
    const base = renderBaseTypeFor(context.library, reactTarget({ library: context.library, imports }), param.type);
    return param.nullable || param.optional ? `${base} | null` : base;
};

const optionalLine = (prop: string, type: string): string => {
    const withNull = type.endsWith(" | null") ? type : `${type} | null`;
    return `${prop}?: ${withNull} | undefined;`;
};

type FieldLine = { field: string; text: string };

const itemTypeName = (type: string, prop: string): string => `${type}${upperFirst(prop)}Entry`;

type ItemTypeRef = (arg: BuildArg) => string;

type RenderContext = {
    gir: GirIndex;
    imports: ElementPropImports;
    itemTypeRef: ItemTypeRef;
    refer: (type: string, prop: string) => string | undefined;
};

const callFieldLines = (context: RenderContext, type: string, call: Call): FieldLine[] => {
    if (typeof call === "string") return [];
    const method = findMethod(context.gir, type, call.method);
    const lines: FieldLine[] = [];
    call.args.forEach((arg, positionIndex) => {
        if (isBuildArg(arg)) {
            lines.push({ field: arg.from, text: `${arg.from}?: ${context.itemTypeRef(arg)}[];` });
            return;
        }
        if (typeof arg !== "object" || !("field" in arg)) return;
        const param = method?.params[positionIndex];
        const optional = "or" in arg || param?.nullable === true || param?.optional === true;
        lines.push({
            field: arg.field,
            text: `${arg.field}${optional ? "?" : ""}: ${renderParamType(context.gir, context.imports.gi, param)};`,
        });
    });
    return lines;
};

const mergedFieldsType = (lines: FieldLine[]): string => {
    const seen = new Set<string>();
    const texts: string[] = [];
    for (const line of lines) {
        if (seen.has(line.field)) continue;
        seen.add(line.field);
        texts.push(line.text);
    }
    return `{ ${texts.join(" ")} }`;
};

const callFieldsType = (context: RenderContext, type: string, call: Call | Call[]): string => {
    if (Array.isArray(call)) return mergedFieldsType(call.flatMap((entry) => callFieldLines(context, type, entry)));
    if (typeof call === "string") {
        const method = findMethod(context.gir, type, call);
        return renderParamType(context.gir, context.imports.gi, method?.params[0]);
    }
    const lines = callFieldLines(context, type, call);
    if (lines.length > 0) return mergedFieldsType(lines);
    const method = findMethod(context.gir, type, call.method);
    return renderParamType(context.gir, context.imports.gi, method?.params[0]);
};

type NamedItemType = { type: string; rule: ListProp; namespaceName: string; typeName: string };

const collectNamedItemTypes = (
    context: GirIndex,
    elementProps: Record<string, ElementProp[]>,
): Map<string, NamedItemType> => {
    const named = new Map<string, NamedItemType>();
    const listRules = new Map<string, { type: string; rule: ListProp }>();
    for (const [type, props] of Object.entries(elementProps)) {
        for (const rule of props) {
            if (rule.kind === "list") listRules.set(`${type}:${rule.prop}`, { type, rule });
        }
    }
    const claim = (key: string): void => {
        const entry = listRules.get(key);
        const namespaceName = entry === undefined ? undefined : context.index.get(entry.type)?.namespace.name;
        if (entry === undefined || namespaceName === undefined || named.has(key)) return;
        named.set(key, { ...entry, namespaceName, typeName: itemTypeName(entry.type, entry.rule.prop) });
    };
    for (const [key, { rule }] of listRules) {
        const builds = buildArgsOf(rule);
        if (builds.length === 0) continue;
        claim(key);
        for (const arg of builds) claim(`${arg.build}:${arg.prop}`);
    }
    return named;
};

const appliedPropLine = (context: RenderContext, type: string, prop: AppliedProp, named?: string): string | null => {
    if (hasProperty(context.gir, type, prop.prop)) return null;
    if (prop.kind === "value") return optionalLine(prop.prop, callFieldsType(context, type, prop.call));
    if (prop.kind === "list") {
        const item = named ?? callFieldsType(context, type, prop.add);
        return optionalLine(prop.prop, `${item}[]`);
    }
    return null;
};

const collectCallContributions = (
    context: GirIndex,
    contributions: PropContribution[],
    container: { parent: string; child: string },
    call: Exclude<ContainerProp["append"], string | undefined>,
): void => {
    const method = findMethod(context, container.parent, call.method);
    call.args.forEach((arg, positionIndex) => {
        if (typeof arg !== "object" || isBuildArg(arg) || !("prop" in arg)) return;
        const param = method?.params[positionIndex];
        if (param === undefined) return;
        if (hasProperty(context, container.child, arg.prop)) return;
        if (contributions.some((entry) => entry.child === container.child && entry.prop === arg.prop)) return;
        contributions.push({ child: container.child, prop: arg.prop, param });
    });
};

const collectPropContributions = (
    context: GirIndex,
    elementProps: Record<string, ElementProp[]>,
): PropContribution[] => {
    const contributions: PropContribution[] = [];
    forEachContainer(elementProps, (parent, cp) => {
        for (const call of [cp.append, cp.remove, cp.insert, cp.reorder]) {
            if (call === undefined || typeof call === "string") continue;
            collectCallContributions(context, contributions, { parent, child: cp.child }, call);
        }
    });
    return contributions;
};

const directTypeNames = (context: GirIndex, klass: GirClass, namespace: GirNamespace): Set<string> => {
    const names = new Set<string>();
    const glibName = glibNameOf(klass);
    if (glibName !== undefined) names.add(glibName);
    for (const name of klass.implements) {
        const resolved = context.library.resolveType(namespace.name, name);
        if (resolved === undefined || resolved.kind !== "interface") continue;
        const ifaceGlib = glibNameOf(resolved.value);
        if (ifaceGlib !== undefined) names.add(ifaceGlib);
    }
    return names;
};

const constructOnlyNames = (context: GirIndex, entry: GirTypeEntry): string[] => {
    const names: string[] = [];
    for (const klass of chainOf(context, entry)) {
        for (const property of klass.properties) {
            if (property.constructOnly) names.push(toCamelIdentifier(property.name));
        }
    }
    return names;
};

const methodReturnGlib = (context: GirIndex, typeName: string, methodCamel: string): string | undefined => {
    const method = findMethod(context, typeName, methodCamel);
    const ref = method?.fn.returnValue.type;
    if (ref === undefined) return undefined;
    const resolved = context.library.typeOf(ref);
    if (resolved === undefined || resolved.kind !== "class") return undefined;
    return glibNameOf(resolved.value);
};

const resolveAdoptElement = (context: GirIndex, parent: string, cp: ContainerProp): string | undefined => {
    if (cp.adopt === undefined) return undefined;
    const source = typeof cp.adopt === "string" ? cp.adopt : cp.append;
    if (source === undefined) return undefined;
    const method = typeof source === "string" ? source : source.method;
    return methodReturnGlib(context, parent, method);
};

const lazyElementExportOf = (context: GirIndex, element: string): LazyElementSpec => {
    const typeName = `${element}ElementProps`;
    const elementClass = context.index.get(element);
    if (elementClass === undefined) {
        return { element, typeName, typeSource: `export type ${typeName} = { children?: ReactNode };` };
    }
    const baseName = glibNameOf(elementClass.klass) ?? element;
    const omitted = constructOnlyNames(context, elementClass);
    const omitUnion = omitted.map((name) => JSON.stringify(name)).join(" | ");
    const base = omitted.length === 0 ? `${baseName}Props` : `Omit<${baseName}Props, ${omitUnion}>`;
    return { element, typeName, typeSource: `export type ${typeName} = ${base};` };
};

const collectLazyElementSpecs = (
    context: GirIndex,
    elementProps: Record<string, ElementProp[]>,
): Map<string, LazyElementSpec[]> => {
    const specs = new Map<string, LazyElementSpec[]>();
    forEachContainer(elementProps, (parent, cp) => {
        const parentEntry = context.index.get(parent);
        if (parentEntry === undefined) return;
        const element = resolveAdoptElement(context, parent, cp);
        if (element === undefined) return;
        const spec = lazyElementExportOf(context, element);
        const list = specs.get(parentEntry.namespace.name) ?? [];
        if (!list.some((existing) => existing.element === spec.element)) list.push(spec);
        specs.set(parentEntry.namespace.name, list);
    });
    return specs;
};

const collectContainerPropNames = (elementProps: Record<string, ElementProp[]>): Map<string, string[]> => {
    const containerPropNamesByParent = new Map<string, string[]>();
    forEachContainer(elementProps, (parent, cp) => {
        if (cp.prop === "children") return;
        const names = containerPropNamesByParent.get(parent) ?? [];
        if (!names.includes(cp.prop)) names.push(cp.prop);
        containerPropNamesByParent.set(parent, names);
    });
    return containerPropNamesByParent;
};

const TEXT_CONTAINERS = ["GtkLabel", "GtkTextBuffer", "GtkTextTag", "GtkTextChildAnchor", "GtkTextView"];

const collectAppliedProps = (elementProps: Record<string, ElementProp[]>): Map<string, AppliedProp[]> => {
    const appliedByType = new Map<string, AppliedProp[]>();
    for (const [type, props] of Object.entries(elementProps)) {
        for (const prop of props) {
            if (prop.kind === "container") continue;
            const list = appliedByType.get(type) ?? [];
            list.push(prop);
            appliedByType.set(type, list);
        }
    }
    return appliedByType;
};

type RenderContextFactory = (namespaceName: string, imports: ElementPropImports) => RenderContext;

const createRenderContextFactory =
    (context: GirIndex, named: Map<string, NamedItemType>): RenderContextFactory =>
    (namespaceName, imports) => {
        const refer = (type: string, prop: string): string | undefined => {
            const entry = named.get(`${type}:${prop}`);
            if (entry === undefined) return undefined;
            if (entry.namespaceName !== namespaceName) imports.jsx.set(entry.typeName, entry.namespaceName);
            return entry.typeName;
        };
        return { gir: context, imports, itemTypeRef: (arg) => refer(arg.build, arg.prop) ?? "unknown", refer };
    };

const createAcceptsChildren = (
    context: GirIndex,
    elementProps: Record<string, ElementProp[]>,
): ((glibName: string) => boolean) => {
    const childrenContainers = new Set<string>(TEXT_CONTAINERS);
    forEachContainer(elementProps, (parent, cp) => {
        if (cp.prop === "children") childrenContainers.add(parent);
        const element = resolveAdoptElement(context, parent, cp);
        if (element !== undefined) childrenContainers.add(element);
    });
    return (glibName) => {
        if (childrenContainers.has(glibName)) return true;
        const entry = context.index.get(glibName);
        if (entry === undefined) return false;
        const chain = chainOf(context, entry);
        if (chain.some((klass) => glibNameOf(klass) === "GtkWidget")) return true;
        return chain.some((klass) => {
            const name = glibNameOf(klass);
            return name !== undefined && childrenContainers.has(name);
        });
    };
};

export const createElementPropTypegen = (
    context: GirIndex,
    elementProps: Record<string, ElementProp[]>,
): ElementPropTypegen => {
    const appliedByType = collectAppliedProps(elementProps);
    const propContributions = collectPropContributions(context, elementProps);
    const lazyElementSpecs = collectLazyElementSpecs(context, elementProps);
    const containerPropNamesByParent = collectContainerPropNames(elementProps);
    const namedItemTypes = collectNamedItemTypes(context, elementProps);
    const renderContext = createRenderContextFactory(context, namedItemTypes);

    const classPropLines = (
        glibName: string,
        klass: GirClass,
        namespace: GirNamespace,
        imports: ElementPropImports,
    ): string[] => {
        const render = renderContext(namespace.name, imports);
        const lines: string[] = [];
        for (const prop of appliedByType.get(glibName) ?? []) {
            const named = prop.kind === "list" ? render.refer(glibName, prop.prop) : undefined;
            const line = appliedPropLine(render, glibName, prop, named);
            if (line !== null) lines.push(line);
        }
        const direct = directTypeNames(context, klass, namespace);
        for (const contribution of propContributions) {
            if (!direct.has(contribution.child)) continue;
            lines.push(optionalLine(contribution.prop, renderParamType(context, imports.gi, contribution.param)));
        }
        return lines;
    };

    const listItemTypeSources = (namespaceName: string, imports: ElementPropImports): string[] => {
        const render = renderContext(namespaceName, imports);
        const sources: string[] = [];
        for (const named of namedItemTypes.values()) {
            if (named.namespaceName !== namespaceName) continue;
            const fields = mergedFieldsType(
                addCalls(named.rule.add).flatMap((call) => callFieldLines(render, named.type, call)),
            );
            sources.push(`export type ${named.typeName} = ${fields};`);
        }
        return sources;
    };

    return {
        classPropLines,
        lazyElementExports: (namespaceName) => lazyElementSpecs.get(namespaceName) ?? [],
        listItemTypeSources,
        containerPropNamesFor: (glibName) => containerPropNamesByParent.get(glibName) ?? [],
        acceptsChildren: createAcceptsChildren(context, elementProps),
    };
};
