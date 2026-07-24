import type { AppliedProp, ContainerProp, ElementProp, ListProp } from "@gtkx/config";
import { toCamelIdentifier } from "@gtkx/utils";
import { renderBaseTypeFor } from "../../analysis/ts-type.js";
import type { GirClass } from "../../gir/class.js";
import type { GirNamespace } from "../../gir/namespace.js";
import type { GirParameter } from "../../gir/parameter.js";
import { PRIMITIVE_TS_TYPE } from "../../gir/primitives.js";
import { chainOf, findMethod, type GirIndex, type GirTypeEntry, hasProperty } from "./gir-index.js";
import { glibNameOf } from "./intrinsic-elements.js";
import { addCalls } from "./list-calls.js";
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
    classPropLines: (glibName: string, imports: ElementPropImports) => string[];
    lazyElementExports: (namespaceName: string) => LazyElementSpec[];
    containerPropNamesFor: (glibName: string) => string[];
    placementPropLines: (glibName: string, imports: ElementPropImports) => string[];
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

type RenderContext = { gir: GirIndex; imports: ElementPropImports };

const NO_DEFAULT = Symbol("gtkx.no-default");

const inferredDefault = (context: GirIndex, param: GirParameter): null | number | boolean | typeof NO_DEFAULT => {
    if (param.nullable) return null;
    const type = param.type === undefined ? undefined : context.library.typeOf(param.type);
    if (type?.kind !== "primitive") return NO_DEFAULT;
    switch (PRIMITIVE_TS_TYPE[type.category]) {
        case "number":
            return 0;
        case "boolean":
            return false;
        default:
            return NO_DEFAULT;
    }
};

const callFieldLines = (context: RenderContext, type: string, method: string): FieldLine[] => {
    const resolved = findMethod(context.gir, type, method);
    return (resolved?.params ?? []).map((param) => {
        const field = toCamelIdentifier(param.name);
        const optional = inferredDefault(context.gir, param) !== NO_DEFAULT || param.optional;
        return {
            field,
            text: `${field}${optional ? "?" : ""}: ${renderParamType(context.gir, context.imports.gi, param)};`,
        };
    });
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

const optionalField = (line: FieldLine): FieldLine => ({ ...line, text: line.text.replace(/^(\w+)\??:/, "$1?:") });

const trailingCallFields = (lines: FieldLine[], itemKey: string | undefined): FieldLine[] =>
    lines.map((line, index) =>
        index === 0 && itemKey !== undefined
            ? { field: itemKey, text: line.text.replace(/^\w+\??:/, `${itemKey}:`) }
            : optionalField(line),
    );

const callFieldsType = (context: RenderContext, type: string, add: ListProp["add"], itemKey?: string): string => {
    const methods = addCalls(add);
    const [first] = methods;
    if (first === undefined) return "unknown";
    if (methods.length === 1) {
        const resolved = findMethod(context.gir, type, first);
        if ((resolved?.params ?? []).length <= 1) {
            return renderParamType(context.gir, context.imports.gi, resolved?.params[0]);
        }
    }
    return mergedFieldsType(
        methods.flatMap((method, index) =>
            index === 0
                ? callFieldLines(context, type, method)
                : trailingCallFields(callFieldLines(context, type, method), itemKey),
        ),
    );
};

const appliedPropLine = (context: RenderContext, type: string, prop: AppliedProp): string | null => {
    if (hasProperty(context.gir, type, prop.prop)) return null;
    if (prop.kind === "value") return optionalLine(prop.prop, callFieldsType(context, type, prop.call));
    if (prop.kind === "list") {
        if (prop.itemType !== undefined) {
            return optionalLine(prop.prop, `import("@gtkx/react").${prop.itemType}[]`);
        }
        const item = callFieldsType(context, type, prop.add, prop.itemKey);
        return optionalLine(prop.prop, `${item}[]`);
    }
    return null;
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

const isChildParameter = (context: GirIndex, param: GirParameter, child: string): boolean => {
    const resolved = param.type === undefined ? undefined : context.library.typeOf(param.type);
    if (resolved === undefined || (resolved.kind !== "class" && resolved.kind !== "interface")) return false;
    return glibNameOf(resolved.value) === child;
};

const attachMethodName = (cp: ContainerProp): string | undefined => cp.append ?? cp.remove;

const collectPlacementProps = (context: GirIndex, elementProps: Record<string, ElementProp[]>): PropContribution[] => {
    const placements: PropContribution[] = [];
    forEachContainer(elementProps, (parent, cp) => {
        const names = cp.childProps;
        const methodName = attachMethodName(cp);
        if (names === undefined || methodName === undefined) return;
        const method = findMethod(context, parent, methodName);
        const spare = (method?.params ?? []).filter((param) => !isChildParameter(context, param, cp.child));
        names.forEach((name, index) => {
            const param = spare[index];
            if (param === undefined || hasProperty(context, cp.child, name)) return;
            if (placements.some((entry) => entry.child === cp.child && entry.prop === name)) return;
            placements.push({ child: cp.child, prop: name, param });
        });
    });
    return placements;
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
    const lazyElementSpecs = collectLazyElementSpecs(context, elementProps);
    const containerPropNamesByParent = collectContainerPropNames(elementProps);
    const placementProps = collectPlacementProps(context, elementProps);

    const classPropLines = (glibName: string, imports: ElementPropImports): string[] => {
        const render: RenderContext = { gir: context, imports };
        const lines: string[] = [];
        for (const prop of appliedByType.get(glibName) ?? []) {
            const line = appliedPropLine(render, glibName, prop);
            if (line !== null) lines.push(line);
        }
        return lines;
    };

    return {
        classPropLines,
        lazyElementExports: (namespaceName) => lazyElementSpecs.get(namespaceName) ?? [],
        containerPropNamesFor: (glibName) => containerPropNamesByParent.get(glibName) ?? [],
        placementPropLines: (glibName, imports) =>
            placementProps
                .filter((entry) => entry.child === glibName)
                .map((entry) => optionalLine(entry.prop, renderParamType(context, imports.gi, entry.param))),
        acceptsChildren: createAcceptsChildren(context, elementProps),
    };
};
