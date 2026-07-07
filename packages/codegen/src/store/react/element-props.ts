import type { Call, ContainerProp, ElementProp, ListProp } from "@gtkx/config";
import { toCamelIdentifier } from "@gtkx/utils";
import { findMethod, type GirIndex, hasMethod, hasProperty } from "./gir-index.js";
import { CURATED_ELEMENT_PROPS } from "./tables.js";

const callMethodName = (call: Call): string => (typeof call === "string" ? call : call.method);

const containerTypeNames = (parent: string, prop: ContainerProp): string[] => {
    const names = [parent, prop.child];
    if (prop.autowrap !== undefined) names.push(prop.autowrap);
    return names;
};

const containerCalls = (prop: ContainerProp): Call[] => {
    const calls = [prop.append, prop.remove, prop.insert, prop.reorder].filter(
        (call): call is Call => call !== undefined,
    );
    if (typeof prop.adopt === "string") calls.push(prop.adopt);
    return calls;
};

const knownTypes = (context: GirIndex, names: string[]): boolean => names.every((name) => context.index.has(name));

const elementPropError = (path: string, message: string): Error => new Error(`gtkx.config.ts: \`${path}\` ${message}`);

const validateTypeNames = (context: GirIndex, path: string, names: string[]): void => {
    for (const name of names) {
        if (!context.index.has(name)) {
            throw elementPropError(path, `references "${name}", which is not a type in the generated libraries`);
        }
    }
};

const validateCalls = (context: GirIndex, path: string, host: string, calls: Call[]): void => {
    for (const call of calls) {
        const method = callMethodName(call);
        if (!hasMethod(context, host, method)) {
            throw elementPropError(path, `references method "${method}", which does not exist on ${host}`);
        }
    }
};

const validateMember = (context: GirIndex, path: string, host: string, name: string): void => {
    if (!hasProperty(context, host, name)) {
        throw elementPropError(path, `references "${name}", which is not a property of ${host}`);
    }
};

const validateUserElementProp = (context: GirIndex, type: string, path: string, prop: ElementProp): void => {
    switch (prop.kind) {
        case "container":
            validateTypeNames(context, path, containerTypeNames(type, prop));
            validateCalls(context, path, type, containerCalls(prop));
            return;
        case "value":
            validateTypeNames(context, path, [type]);
            validateCalls(context, path, type, prop.after === undefined ? [prop.call] : [prop.call, prop.after]);
            return;
        case "controlled-text":
            validateTypeNames(context, path, [type]);
            validateMember(context, path, type, prop.prop);
            return;
        case "lazy":
            validateTypeNames(context, path, [type]);
            validateMember(context, path, type, prop.prop);
            if (prop.lookup !== undefined) validateCalls(context, path, type, [prop.lookup]);
            return;
        case "list":
            validateTypeNames(context, path, [type]);
            validateCalls(context, path, type, listCalls(prop));
            return;
    }
};

const listCalls = (prop: ListProp): Call[] => {
    const calls = [prop.add];
    if (prop.remove !== undefined) calls.push(prop.remove);
    if (prop.clear !== undefined) calls.push(prop.clear);
    return calls;
};

const listItemIsScalar = (context: GirIndex, type: string, add: Call): boolean => {
    if (typeof add !== "string") return false;
    const method = findMethod(context, type, add);
    return method !== undefined && method.params.length === 1;
};

const expandListCall = (context: GirIndex, type: string, call: Call, itemIsScalar: boolean): Call => {
    if (typeof call !== "string" || itemIsScalar) return call;
    const method = findMethod(context, type, call);
    if (method === undefined || method.params.length === 0) return call;
    return { method: call, args: method.params.map((param) => ({ field: toCamelIdentifier(param.name) })) };
};

const expandListProp = (context: GirIndex, type: string, prop: ListProp): ListProp => {
    const scalar = listItemIsScalar(context, type, prop.add);
    return {
        ...prop,
        add: expandListCall(context, type, prop.add, scalar),
        remove: prop.remove === undefined ? undefined : expandListCall(context, type, prop.remove, scalar),
    };
};

const expandListProps = (
    context: GirIndex,
    elementProps: Record<string, ElementProp[]>,
): Record<string, ElementProp[]> => {
    const result: Record<string, ElementProp[]> = {};
    for (const [type, props] of Object.entries(elementProps)) {
        result[type] = props.map((prop) => (prop.kind === "list" ? expandListProp(context, type, prop) : prop));
    }
    return result;
};

const validateUserElementProps = (context: GirIndex, elementProps: Record<string, ElementProp[]>): void => {
    for (const [type, props] of Object.entries(elementProps)) {
        props.forEach((prop, index) => {
            validateUserElementProp(context, type, `elementProps.${type}[${index}]`, prop);
        });
    }
};

const elementPropKey = (prop: ElementProp): string =>
    prop.kind === "container" ? `container:${prop.prop}:${prop.child}` : `applied:${prop.prop}`;

const mergeElementProps = (layers: Record<string, ElementProp[]>[]): Record<string, ElementProp[]> => {
    const byType = new Map<string, Map<string, ElementProp>>();
    for (const layer of layers) {
        for (const [type, props] of Object.entries(layer)) {
            const merged = byType.get(type) ?? new Map<string, ElementProp>();
            for (const prop of props) {
                const key = elementPropKey(prop);
                merged.delete(key);
                merged.set(key, prop);
            }
            byType.set(type, merged);
        }
    }
    const result: Record<string, ElementProp[]> = {};
    for (const [type, merged] of byType) result[type] = [...merged.values()];
    return result;
};

const filterKnownElementProps = (
    context: GirIndex,
    map: Record<string, ElementProp[]>,
): Record<string, ElementProp[]> => {
    const result: Record<string, ElementProp[]> = {};
    for (const [type, props] of Object.entries(map)) {
        if (!context.index.has(type)) continue;
        const kept = props.filter(
            (prop) => prop.kind !== "container" || knownTypes(context, containerTypeNames(type, prop)),
        );
        if (kept.length > 0) result[type] = kept;
    }
    return result;
};

export const assembleElementProps = (
    context: GirIndex,
    userElementProps: Record<string, ElementProp[]>,
): Record<string, ElementProp[]> => {
    validateUserElementProps(context, userElementProps);
    const merged = mergeElementProps([
        filterKnownElementProps(context, CURATED_ELEMENT_PROPS),
        filterKnownElementProps(context, userElementProps),
    ]);
    return expandListProps(context, merged);
};
