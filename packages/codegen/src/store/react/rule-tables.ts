import type {
    AttachRule,
    Call,
    ContainerProp,
    ManyContainerProp,
    OneContainerProp,
    RelationshipRule,
    ResolvedGtkxRules,
    SyntheticPropRule,
} from "@gtkx/config";
import { toCamelIdentifier } from "@gtkx/utils";
import { ancestorChain } from "../../gir/ancestry.js";
import type { GirClass } from "../../gir/class.js";
import type { Library } from "../../gir/library.js";
import type { GirNamespace } from "../../gir/namespace.js";
import { type AttachShape, collectAttachShapes } from "./attach-shapes.js";
import { glibNameOf, implementedInterfaces } from "./intrinsic-elements.js";
import { CONTAINER_PROPS, containerPropsToRelationships, RELATIONSHIP_RULES, SYNTHETIC_PROP_RULES } from "./tables.js";

export type RuleTables = {
    containerProps: Record<string, ContainerProp[]>;
    relationships: RelationshipRule[];
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

const relationshipTypeNames = (rule: RelationshipRule): string[] => {
    switch (rule.kind) {
        case "attach":
            return rule.autowrap === undefined ? [rule.parent, rule.child] : [rule.parent, rule.child, rule.autowrap];
        case "companion":
            return [rule.parent];
        case "reject":
            return [rule.parent, rule.child];
    }
};

const relationshipCalls = (rule: RelationshipRule): Call[] => {
    switch (rule.kind) {
        case "attach":
            return [rule.add, rule.remove, rule.insert, rule.reorder].filter((call) => call !== undefined);
        case "companion":
            return [rule.add, rule.insert, rule.remove, rule.companion, ...Object.values(rule.setters ?? {})].filter(
                (call) => call !== undefined,
            );
        default:
            return [];
    }
};

const relationshipCallHost = (rule: RelationshipRule): string | undefined => {
    switch (rule.kind) {
        case "attach":
        case "companion":
            return rule.parent;
        default:
            return undefined;
    }
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

const validateUserRelationship = (context: GirContext, path: string, rule: RelationshipRule): void => {
    validateUserTypeNames(context, path, relationshipTypeNames(rule));
    const host = relationshipCallHost(rule);
    if (host !== undefined) validateUserCalls(context, path, host, relationshipCalls(rule));
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

const relationshipKey = (rule: RelationshipRule): string => {
    switch (rule.kind) {
        case "attach":
            return `attach:${rule.parent}:${rule.child}:${rule.slot ?? ""}`;
        case "companion":
            return `element:${rule.element}`;
        case "reject":
            return `reject:${rule.parent}:${rule.child}`;
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

const generatedRuleFor = (glibName: string, shapes: Set<AttachShape>): AttachRule | undefined => {
    const add = generatedAdd(shapes);
    const remove = generatedRemove(shapes);
    if (add === undefined && remove === undefined) return undefined;
    const rule: AttachRule = { kind: "attach", parent: glibName, child: "GtkWidget" };
    if (add !== undefined) rule.add = add;
    if (remove !== undefined) rule.remove = remove;
    const insert = generatedInsert(shapes);
    if (insert !== undefined) rule.insert = insert;
    const reorder = generatedReorder(shapes);
    if (reorder !== undefined) rule.reorder = reorder;
    return rule;
};

const collectGeneratedRelationships = (context: GirContext): AttachRule[] => {
    const shapeTable = collectAttachShapes(context.library);
    const rules: AttachRule[] = [];
    for (const [glibName, ownShapes] of Object.entries(shapeTable)) {
        if (!ownShapes.some((shape) => STRATEGY_SHAPES.has(shape))) continue;
        const entry = context.index.get(glibName);
        if (entry === undefined) continue;
        const rule = generatedRuleFor(glibName, effectiveShapes(context, shapeTable, entry));
        if (rule !== undefined) rules.push(rule);
    }
    return rules;
};

const SETTER_METHODS: Set<string> = new Set(["setChild", "setContent"]);

const isSetterMethod = (call: Call): boolean => SETTER_METHODS.has(callMethodName(call));

const containerPropFromAttach = (rule: AttachRule): ContainerProp => {
    const prop = rule.slot ?? "children";
    if (rule.add !== undefined && isSetterMethod(rule.add)) {
        const one: OneContainerProp = { arity: "one", prop, child: rule.child, set: rule.add };
        if (rule.remove !== undefined) one.unset = rule.remove;
        return one;
    }
    const many: ManyContainerProp = { arity: "many", prop, child: rule.child };
    if (rule.add !== undefined) many.append = rule.add;
    if (rule.remove !== undefined) many.remove = rule.remove;
    if (rule.insert !== undefined) many.insert = rule.insert;
    if (rule.reorder !== undefined) many.reorder = rule.reorder;
    if (rule.autowrap !== undefined) many.autowrap = rule.autowrap;
    return many;
};

const containerPropTypeNames = (parent: string, cp: ContainerProp): string[] => {
    const names = [parent, cp.child];
    if (cp.arity === "many" && cp.autowrap !== undefined) names.push(cp.autowrap);
    if (cp.adopt !== undefined) names.push(cp.adopt.element);
    return names;
};

const containerPropKey = (cp: ContainerProp): string =>
    cp.adopt === undefined ? `${cp.prop}:${cp.child}` : `adopt:${cp.adopt.element}`;

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
    const result: Record<string, ContainerProp[]> = {};
    for (const rule of collectGeneratedRelationships(context)) {
        const props = result[rule.parent] ?? [];
        props.push(containerPropFromAttach(rule));
        result[rule.parent] = props;
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
    const userContainerRelationships = containerPropsToRelationships(userRules.containerProps);
    let position = 0;
    for (const rule of userRules.relationships) {
        validateUserRelationship(context, `rules.relationships[${position}]`, rule);
        position++;
    }
    for (const rule of userContainerRelationships) {
        validateUserRelationship(context, "rules.containerProps", rule);
    }
    position = 0;
    for (const rule of userRules.syntheticProps) {
        validateUserSynthetic(context, `rules.syntheticProps[${position}]`, rule);
        position++;
    }
    const generated = collectGeneratedRelationships(context);
    const curatedRelationships = RELATIONSHIP_RULES.filter((rule) => knownTypes(context, relationshipTypeNames(rule)));
    const curatedSynthetics = SYNTHETIC_PROP_RULES.filter((rule) => context.index.has(rule.type));
    const containerProps = mergeContainerProps([
        collectGeneratedContainerProps(context),
        filterKnownContainerProps(context, CONTAINER_PROPS),
        filterKnownContainerProps(context, userRules.containerProps),
    ]);
    return {
        containerProps,
        relationships: mergeByKey(
            [generated, curatedRelationships, userRules.relationships, userContainerRelationships],
            relationshipKey,
        ),
        syntheticProps: mergeByKey([curatedSynthetics, userRules.syntheticProps], syntheticKey),
    };
};
