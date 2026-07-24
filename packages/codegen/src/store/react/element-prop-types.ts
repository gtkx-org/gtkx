import type { ContainerProp, ElementProp } from "@gtkx/config";
import { toCamelIdentifier } from "@gtkx/utils";
import { chainOf, findMethod, type GirIndex, type GirTypeEntry } from "./gir-index.js";
import { glibNameOf } from "./intrinsic-elements.js";

export type LazyElementSpec = {
    element: string;
    typeName: string;
    typeSource: string;
};

export type ElementPropTypegen = {
    lazyElementExports: (namespaceName: string) => LazyElementSpec[];
    acceptsChildren: (glibName: string) => boolean;
};

export const forEachContainer = (
    elementProps: Record<string, ElementProp[]>,
    visit: (type: string, prop: ContainerProp) => void,
): void => {
    for (const [type, props] of Object.entries(elementProps)) {
        for (const prop of props) {
            if (prop.kind === "container") visit(type, prop);
        }
    }
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

export const resolveAdoptElement = (context: GirIndex, parent: string, cp: ContainerProp): string | undefined => {
    if (cp.adopt === undefined) return undefined;
    if (typeof cp.adopt === "object") return cp.adopt.element;
    const method = typeof cp.adopt === "string" ? cp.adopt : cp.append;
    if (method === undefined) return undefined;
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

const TEXT_CONTAINERS = ["GtkLabel", "GtkTextBuffer", "GtkTextTag", "GtkTextChildAnchor", "GtkTextView"];

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
    const lazyElementSpecs = collectLazyElementSpecs(context, elementProps);
    return {
        lazyElementExports: (namespaceName) => lazyElementSpecs.get(namespaceName) ?? [],
        acceptsChildren: createAcceptsChildren(context, elementProps),
    };
};
