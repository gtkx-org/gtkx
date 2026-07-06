import type { Call, ContainerProp, ResolvedGtkxRules, SyntheticPropRule } from "@gtkx/config";
import { toCamelIdentifier } from "@gtkx/utils";
import { ancestorChain } from "../../gir/ancestry.js";
import type { GirClass } from "../../gir/class.js";
import type { Library } from "../../gir/library.js";
import type { GirNamespace } from "../../gir/namespace.js";
import { type AttachShape, collectAttachShapes } from "./attach-shapes.js";
import { glibNameOf, implementedInterfaces } from "./intrinsic-elements.js";
import { CONTAINER_PROPS, SYNTHETIC_PROP_RULES } from "./tables.js";

export type RuleTables = {
    containerProps: Record<string, ContainerProp[]>;
    syntheticProps: SyntheticPropRule[];
};

type TypeEntry = {
    klass: GirClass;
    namespace: GirNamespace;
    isInterface: boolean;
};

type GirContext = {
    library: Library;
    index: Map<string, TypeEntry>;
};

const buildGirContext = (library: Library): GirContext => {
    const index = new Map<string, TypeEntry>();
    for (const namespace of library.namespaces.values()) {
        for (const klass of namespace.classes) {
            const glibName = glibNameOf(klass);
            if (glibName !== undefined && !index.has(glibName)) {
                index.set(glibName, { klass, namespace, isInterface: false });
            }
        }
        for (const klass of namespace.interfaces) {
            const glibName = glibNameOf(klass);
            if (glibName !== undefined && !index.has(glibName)) {
                index.set(glibName, { klass, namespace, isInterface: true });
            }
        }
    }
    return { library, index };
};

const chainOf = (context: GirContext, entry: TypeEntry): GirClass[] => {
    if (entry.isInterface) return [entry.klass];
    const chain: GirClass[] = [];
    for (const { klass } of ancestorChain(context.library, entry.klass, entry.namespace.name)) chain.push(klass);
    for (const iface of implementedInterfaces(entry.klass, entry.namespace, context.library)) chain.push(iface.klass);
    return chain;
};

const hasMethod = (context: GirContext, typeName: string, camelName: string): boolean => {
    const entry = context.index.get(typeName);
    if (entry === undefined) return false;
    return chainOf(context, entry).some((klass) =>
        klass.methods.some((method) => method.introspectable && toCamelIdentifier(method.name) === camelName),
    );
};

const hasProperty = (context: GirContext, typeName: string, camelName: string): boolean => {
    const entry = context.index.get(typeName);
    if (entry === undefined) return false;
    return chainOf(context, entry).some((klass) =>
        klass.properties.some((property) => toCamelIdentifier(property.name) === camelName),
    );
};

const callMethodName = (call: Call): string => (typeof call === "string" ? call : call.method);

const containerPropTypeNames = (parent: string, cp: ContainerProp): string[] => {
    const names = [parent, cp.child];
    if (cp.autowrap !== undefined) names.push(cp.autowrap);
    return names;
};

const containerPropCalls = (cp: ContainerProp): Call[] => {
    const calls = [cp.append, cp.remove, cp.insert, cp.reorder].filter((call): call is Call => call !== undefined);
    if (typeof cp.adopt === "string") calls.push(cp.adopt);
    return calls;
};

const syntheticCalls = (rule: SyntheticPropRule): Call[] => {
    switch (rule.kind) {
        case "list":
            return [rule.clear, rule.add];
        case "keyed-list":
            return [rule.add, rule.remove, ...Object.values(rule.setters ?? {})];
        case "value":
            return rule.after === undefined ? [rule.call] : [rule.call, rule.after];
        case "selection":
            return rule.lookup === undefined ? [rule.get, rule.set] : [rule.get, rule.set, rule.lookup];
        case "controlled-text":
            return [rule.get];
        case "reassert":
            return [];
        case "write-once-list":
            return [rule.add];
    }
};

const syntheticSettableNames = (rule: SyntheticPropRule): string[] => {
    switch (rule.kind) {
        case "controlled-text":
            return [rule.set];
        case "reassert":
            return [callMethodName(rule.set)];
        default:
            return [];
    }
};

const knownTypes = (context: GirContext, names: string[]): boolean => names.every((name) => context.index.has(name));

const userRuleError = (path: string, message: string): Error => new Error(`gtkx.config.ts: \`${path}\` ${message}`);

const validateUserTypeNames = (context: GirContext, path: string, names: string[]): void => {
    for (const name of names) {
        if (!context.index.has(name)) {
            throw userRuleError(path, `references "${name}", which is not a type in the generated libraries`);
        }
    }
};

const validateUserCalls = (context: GirContext, path: string, host: string, calls: Call[]): void => {
    for (const call of calls) {
        const method = callMethodName(call);
        if (!hasMethod(context, host, method)) {
            throw userRuleError(path, `references method "${method}", which does not exist on ${host}`);
        }
    }
};

const validateUserContainerProps = (context: GirContext, containerProps: Record<string, ContainerProp[]>): void => {
    for (const [parent, props] of Object.entries(containerProps)) {
        props.forEach((cp, index) => {
            const path = `rules.containerProps.${parent}[${index}]`;
            validateUserTypeNames(context, path, containerPropTypeNames(parent, cp));
            validateUserCalls(context, path, parent, containerPropCalls(cp));
        });
    }
};

const validateUserSynthetic = (context: GirContext, path: string, rule: SyntheticPropRule): void => {
    validateUserTypeNames(context, path, [rule.type]);
    validateUserCalls(context, path, rule.type, syntheticCalls(rule));
    for (const name of syntheticSettableNames(rule)) {
        if (!hasMethod(context, rule.type, name) && !hasProperty(context, rule.type, name)) {
            throw userRuleError(path, `references "${name}", which is neither a method nor a property of ${rule.type}`);
        }
    }
};

const syntheticKey = (rule: SyntheticPropRule): string => `${rule.type}:${rule.prop}`;

const mergeByKey = <T>(layers: T[][], keyOf: (rule: T) => string): T[] => {
    const merged = new Map<string, T>();
    for (const layer of layers) {
        for (const rule of layer) {
            merged.delete(keyOf(rule));
            merged.set(keyOf(rule), rule);
        }
    }
    return [...merged.values()];
};

const ATTACH_ADD_PRIORITY: AttachShape[] = ["append", "add", "setContent", "setChild"];

const generatedAdd = (shapes: Set<AttachShape>): Call | undefined =>
    ATTACH_ADD_PRIORITY.find((shape) => shapes.has(shape));

const generatedRemove = (shapes: Set<AttachShape>): Call | undefined => {
    if (shapes.has("append") || shapes.has("add")) return shapes.has("remove") ? "remove" : undefined;
    if (shapes.has("setContent")) return { method: "setContent", args: [{ literal: null }] };
    if (shapes.has("setChild")) return { method: "setChild", args: [{ literal: null }] };
    return shapes.has("remove") ? "remove" : undefined;
};

const generatedInsert = (shapes: Set<AttachShape>): Call | undefined => {
    if (shapes.has("insert")) return { method: "insert", args: ["child", "index"] };
    if (shapes.has("insertChildAfter")) return { method: "insertChildAfter", args: ["child", "sibling"] };
    return undefined;
};

const generatedReorder = (shapes: Set<AttachShape>): Call | undefined =>
    shapes.has("reorderChildAfter") ? { method: "reorderChildAfter", args: ["child", "sibling"] } : undefined;

const STRATEGY_SHAPES: Set<AttachShape> = new Set([
    "append",
    "add",
    "setContent",
    "setChild",
    "remove",
    "insert",
    "insertChildAfter",
    "reorderChildAfter",
]);

const effectiveShapes = (
    context: GirContext,
    shapeTable: Record<string, AttachShape[]>,
    entry: TypeEntry,
): Set<AttachShape> => {
    const effective = new Set<AttachShape>();
    for (const klass of chainOf(context, entry)) {
        const chainName = glibNameOf(klass);
        if (chainName === undefined) continue;
        for (const shape of shapeTable[chainName] ?? []) effective.add(shape);
    }
    return effective;
};

const generatedContainerPropFor = (shapes: Set<AttachShape>): ContainerProp | undefined => {
    const append = generatedAdd(shapes);
    const remove = generatedRemove(shapes);
    if (append === undefined && remove === undefined) return undefined;
    const cp: ContainerProp = { prop: "children", child: "GtkWidget" };
    if (append !== undefined) cp.append = append;
    if (remove !== undefined) cp.remove = remove;
    const insert = generatedInsert(shapes);
    if (insert !== undefined) cp.insert = insert;
    const reorder = generatedReorder(shapes);
    if (reorder !== undefined) cp.reorder = reorder;
    return cp;
};

const containerPropKey = (cp: ContainerProp): string => `${cp.prop}:${cp.child}`;

const mergeContainerProps = (layers: Record<string, ContainerProp[]>[]): Record<string, ContainerProp[]> => {
    const byParent = new Map<string, Map<string, ContainerProp>>();
    for (const layer of layers) {
        for (const [parent, props] of Object.entries(layer)) {
            const merged = byParent.get(parent) ?? new Map<string, ContainerProp>();
            for (const cp of props) {
                const key = containerPropKey(cp);
                merged.delete(key);
                merged.set(key, cp);
            }
            byParent.set(parent, merged);
        }
    }
    const result: Record<string, ContainerProp[]> = {};
    for (const [parent, merged] of byParent) result[parent] = [...merged.values()];
    return result;
};

const collectGeneratedContainerProps = (context: GirContext): Record<string, ContainerProp[]> => {
    const shapeTable = collectAttachShapes(context.library);
    const result: Record<string, ContainerProp[]> = {};
    for (const [glibName, ownShapes] of Object.entries(shapeTable)) {
        if (!ownShapes.some((shape) => STRATEGY_SHAPES.has(shape))) continue;
        const entry = context.index.get(glibName);
        if (entry === undefined) continue;
        const cp = generatedContainerPropFor(effectiveShapes(context, shapeTable, entry));
        if (cp === undefined) continue;
        const props = result[glibName] ?? [];
        props.push(cp);
        result[glibName] = props;
    }
    return result;
};

const filterKnownContainerProps = (
    context: GirContext,
    map: Record<string, ContainerProp[]>,
): Record<string, ContainerProp[]> => {
    const result: Record<string, ContainerProp[]> = {};
    for (const [parent, props] of Object.entries(map)) {
        const kept = props.filter((cp) => knownTypes(context, containerPropTypeNames(parent, cp)));
        if (kept.length > 0) result[parent] = kept;
    }
    return result;
};

export const assembleRuleTables = (library: Library, userRules: ResolvedGtkxRules): RuleTables => {
    const context = buildGirContext(library);
    validateUserContainerProps(context, userRules.containerProps);
    let position = 0;
    for (const rule of userRules.syntheticProps) {
        validateUserSynthetic(context, `rules.syntheticProps[${position}]`, rule);
        position++;
    }
    const curatedSynthetics = SYNTHETIC_PROP_RULES.filter((rule) => context.index.has(rule.type));
    const containerProps = mergeContainerProps([
        collectGeneratedContainerProps(context),
        filterKnownContainerProps(context, CONTAINER_PROPS),
        filterKnownContainerProps(context, userRules.containerProps),
    ]);
    return {
        containerProps,
        syntheticProps: mergeByKey([curatedSynthetics, userRules.syntheticProps], syntheticKey),
    };
};
