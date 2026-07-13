import type { Arg, Call, ContainerProp, ElementProp, ListProp, ValueProp } from "@gtkx/config";
import { toCamelIdentifier } from "@gtkx/utils";
import type { GirParameter } from "../../gir/parameter.js";
import { PRIMITIVE_TS_TYPE } from "../../gir/primitives.js";
import { BUILT_IN_ELEMENT_PROPS } from "./built-ins.js";
import { findMethod, type GirIndex, hasMethod, hasProperty } from "./gir-index.js";

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

const argForParameter = (context: GirIndex, param: GirParameter): Arg => {
    const field = toCamelIdentifier(param.name);
    const or = inferredDefault(context, param);
    return or === NO_DEFAULT ? { field } : { field, or };
};

const callArity = (context: GirIndex, type: string, call: Call): number | undefined =>
    typeof call === "string" ? findMethod(context, type, call)?.params.length : undefined;

const expandCall = (context: GirIndex, type: string, call: Call, scalar: boolean): Call => {
    if (typeof call !== "string" || scalar) return call;
    const method = findMethod(context, type, call);
    if (method === undefined || method.params.length === 0) return call;
    return { method: call, args: method.params.map((param) => argForParameter(context, param)) };
};

const expandListProp = (context: GirIndex, type: string, prop: ListProp): ListProp => {
    const scalar = callArity(context, type, prop.add) === 1;
    return {
        ...prop,
        add: expandCall(context, type, prop.add, scalar),
        remove: prop.remove === undefined ? undefined : expandCall(context, type, prop.remove, scalar),
    };
};

const expandValueProp = (context: GirIndex, type: string, prop: ValueProp): ValueProp => {
    const arity = callArity(context, type, prop.call);
    return { ...prop, call: expandCall(context, type, prop.call, arity === undefined || arity <= 1) };
};

const expandAppliedProps = (
    context: GirIndex,
    elementProps: Record<string, ElementProp[]>,
): Record<string, ElementProp[]> => {
    const result: Record<string, ElementProp[]> = {};
    for (const [type, props] of Object.entries(elementProps)) {
        result[type] = props.map((prop) => {
            if (prop.kind === "list") return expandListProp(context, type, prop);
            if (prop.kind === "value") return expandValueProp(context, type, prop);
            return prop;
        });
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
        filterKnownElementProps(context, BUILT_IN_ELEMENT_PROPS),
        filterKnownElementProps(context, userElementProps),
    ]);
    return expandAppliedProps(context, merged);
};
