import type {
    AttachRule,
    AttachShape,
    Call,
    RelationshipRule,
    ResolvedGtkxRules,
    SyntheticPropRule,
} from "@gtkx/config";
import { toCamelIdentifier } from "@gtkx/utils";
import { ancestorChain } from "../../gir/ancestry.js";
import type { GirClass } from "../../gir/class.js";
import type { Library } from "../../gir/library.js";
import type { GirNamespace } from "../../gir/namespace.js";
import { collectAttachShapes } from "./attach-shapes.js";
import { glibNameOf, implementedInterfaces } from "./intrinsic-elements.js";
import { RELATIONSHIP_RULES, SYNTHETIC_PROP_RULES } from "./tables.js";

export type RuleTables = {
    relationships: RelationshipRule[];
    syntheticProps: SyntheticPropRule[];
};

type TypeEntry = {
    klass: GirClass;
    namespace: GirNamespace;
    isInterface: boolean;
};

type TypeIndex = Map<string, TypeEntry>;

const buildTypeIndex = (library: Library): TypeIndex => {
    const index: TypeIndex = new Map();
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
    return index;
};

const chainOf = (library: Library, entry: TypeEntry): GirClass[] => {
    if (entry.isInterface) return [entry.klass];
    const chain: GirClass[] = [];
    for (const { klass } of ancestorChain(library, entry.klass, entry.namespace.name)) chain.push(klass);
    for (const iface of implementedInterfaces(entry.klass, entry.namespace, library)) chain.push(iface.klass);
    return chain;
};

const hasMethod = (library: Library, index: TypeIndex, typeName: string, camelName: string): boolean => {
    const entry = index.get(typeName);
    if (entry === undefined) return false;
    return chainOf(library, entry).some((klass) =>
        klass.methods.some((method) => method.introspectable && toCamelIdentifier(method.name) === camelName),
    );
};

const hasProperty = (library: Library, index: TypeIndex, typeName: string, camelName: string): boolean => {
    const entry = index.get(typeName);
    if (entry === undefined) return false;
    return chainOf(library, entry).some((klass) =>
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
        case "layout-child":
            return [rule.parent, rule.layout];
        case "reject":
            return [rule.parent, rule.child];
        case "skip":
            return [rule.child];
    }
};

const relationshipCalls = (rule: RelationshipRule): Call[] => {
    switch (rule.kind) {
        case "attach":
            return [rule.add, rule.remove, rule.insert, rule.reorder].filter((call) => call !== undefined);
        case "companion":
            return [
                rule.add,
                rule.insert,
                rule.remove,
                rule.companion,
                ...Object.values(rule.setters ?? {}),
            ].filter((call) => call !== undefined);
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
            return rule.then === undefined ? [rule.call] : [rule.call, rule.then];
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

const knownTypes = (index: TypeIndex, names: string[]): boolean => names.every((name) => index.has(name));

const userRuleError = (path: string, message: string): Error => new Error(`gtkx.config.ts: \`${path}\` ${message}`);

const validateUserTypeNames = (index: TypeIndex, path: string, names: string[]): void => {
    for (const name of names) {
        if (!index.has(name)) {
            throw userRuleError(path, `references "${name}", which is not a type in the generated libraries`);
        }
    }
};

const validateUserCalls = (library: Library, index: TypeIndex, path: string, host: string, calls: Call[]): void => {
    for (const call of calls) {
        const method = callMethodName(call);
        if (!hasMethod(library, index, host, method)) {
            throw userRuleError(path, `references method "${method}", which does not exist on ${host}`);
        }
    }
};

const validateUserRelationship = (library: Library, index: TypeIndex, path: string, rule: RelationshipRule): void => {
    validateUserTypeNames(index, path, relationshipTypeNames(rule));
    const host = relationshipCallHost(rule);
    if (host !== undefined) validateUserCalls(library, index, path, host, relationshipCalls(rule));
};

const validateUserSynthetic = (library: Library, index: TypeIndex, path: string, rule: SyntheticPropRule): void => {
    validateUserTypeNames(index, path, [rule.type]);
    validateUserCalls(library, index, path, rule.type, syntheticCalls(rule));
    for (const name of syntheticSettableNames(rule)) {
        if (!hasMethod(library, index, rule.type, name) && !hasProperty(library, index, rule.type, name)) {
            throw userRuleError(path, `references "${name}", which is neither a method nor a property of ${rule.type}`);
        }
    }
};

const relationshipKey = (rule: RelationshipRule): string => {
    switch (rule.kind) {
        case "attach":
            return `attach:${rule.parent}:${rule.child}:${rule.slot ?? ""}`;
        case "companion":
        case "layout-child":
            return `element:${rule.element}`;
        case "reject":
            return `reject:${rule.parent}:${rule.child}`;
        case "skip":
            return `skip:${rule.child}`;
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

const collectGeneratedRelationships = (library: Library, index: TypeIndex): AttachRule[] => {
    const shapeTable = collectAttachShapes(library);
    const rules: AttachRule[] = [];
    for (const [glibName, ownShapes] of Object.entries(shapeTable)) {
        if (!ownShapes.some((shape) => STRATEGY_SHAPES.has(shape))) continue;
        const entry = index.get(glibName);
        if (entry === undefined) continue;
        const effective = new Set<AttachShape>();
        for (const klass of chainOf(library, entry)) {
            const chainName = glibNameOf(klass);
            if (chainName === undefined) continue;
            for (const shape of shapeTable[chainName] ?? []) effective.add(shape);
        }
        const rule: AttachRule = { kind: "attach", parent: glibName, child: "GtkWidget" };
        const add = generatedAdd(effective);
        const remove = generatedRemove(effective);
        const insert = generatedInsert(effective);
        const reorder = generatedReorder(effective);
        if (add === undefined && remove === undefined) continue;
        if (add !== undefined) rule.add = add;
        if (remove !== undefined) rule.remove = remove;
        if (insert !== undefined) rule.insert = insert;
        if (reorder !== undefined) rule.reorder = reorder;
        rules.push(rule);
    }
    return rules;
};

export const assembleRuleTables = (library: Library, userRules: ResolvedGtkxRules): RuleTables => {
    const index = buildTypeIndex(library);
    userRules.relationships.forEach((rule, position) =>
        validateUserRelationship(library, index, `rules.relationships[${position}]`, rule),
    );
    userRules.syntheticProps.forEach((rule, position) =>
        validateUserSynthetic(library, index, `rules.syntheticProps[${position}]`, rule),
    );
    const generated = collectGeneratedRelationships(library, index);
    const curatedRelationships = RELATIONSHIP_RULES.filter((rule) =>
        knownTypes(index, relationshipTypeNames(rule)),
    );
    const curatedSynthetics = SYNTHETIC_PROP_RULES.filter((rule) => index.has(rule.type));
    return {
        relationships: mergeByKey(
            [generated, curatedRelationships, userRules.relationships],
            relationshipKey,
        ),
        syntheticProps: mergeByKey([curatedSynthetics, userRules.syntheticProps], syntheticKey),
    };
};
