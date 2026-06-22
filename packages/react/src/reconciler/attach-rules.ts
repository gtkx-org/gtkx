/// <reference types="@gtkx/config/env" />

import { CONTAINER_PROPS, ELEMENT_MAP } from "virtual:gtkx-config";
import type { DetachGuard, ElementMapRule, MethodVerb, OrderedInsertVerb, VerbArgs } from "@gtkx/config";
import * as GObject from "@gtkx/gi/gobject";
import { toLowerFirst } from "@gtkx/utils";
import { collectTypeNameChain, findInheritedRow } from "../utils/gtype.js";
import { hasType } from "../utils/gtype-predicates.js";
import type { ElementMapping } from "./element-mapping.js";
import { callMethod } from "./reflect-call.js";
import { type Node, stateOf } from "./state.js";

const exposesMethod = (instance: GObject.Object, method: string): boolean =>
    typeof Reflect.get(instance, method) === "function";

const ruleMatches = (rule: ElementMapRule, child: Node, parent: Node): boolean => {
    if (!(child instanceof GObject.Object) || !(parent instanceof GObject.Object) || !hasType(child, rule.child)) {
        return false;
    }
    if (rule.parentType !== undefined) return hasType(parent, rule.parentType);
    if (rule.parentMethod !== undefined) return exposesMethod(parent, rule.parentMethod);
    return false;
};

const memoizeByGtypePair = <T>(
    compute: (child: Node, parent: Node) => T,
    absent: T,
): ((child: Node, parent: Node) => T) => {
    const cache = new Map<GObject.GType, Map<GObject.GType, T>>();
    return (child, parent) => {
        const childType = child instanceof GObject.Object ? child.__gtype__ : undefined;
        const parentType = parent instanceof GObject.Object ? parent.__gtype__ : undefined;
        if (childType === undefined || parentType === undefined) return absent;
        let perParent = cache.get(childType);
        if (!perParent) {
            perParent = new Map();
            cache.set(childType, perParent);
        }
        const cached = perParent.get(parentType);
        if (cached !== undefined) return cached;
        const result = compute(child, parent);
        perParent.set(parentType, result);
        return result;
    };
};

export const resolveArgs = (shape: VerbArgs, child: Node): unknown[] | null => {
    switch (shape) {
        case "child":
            return [child];
        case "null":
            return [null];
        case "childName": {
            const getName = Reflect.get(child, "getName");
            return typeof getName === "function" ? [Reflect.apply(getName, child, [])] : null;
        }
        case "prefixChild": {
            const prefix = stateOf(child).props["prefix"];
            return typeof prefix === "string" ? [prefix, child] : null;
        }
        case "prefixNull": {
            const prefix = stateOf(child).props["prefix"];
            return typeof prefix === "string" ? [prefix, null] : null;
        }
    }
};

export const callVerb = (parent: Node, method: string, args: unknown[]): void => {
    if (parent instanceof GObject.Object) callMethod(parent, method, args);
};

export const guardHolds = (detachGuard: DetachGuard | undefined, child: Node, parent: Node): boolean => {
    if (!detachGuard) return true;
    const subject = detachGuard.side === "child" ? child : parent;
    const counterpart = detachGuard.side === "child" ? parent : child;
    const getter = Reflect.get(subject, detachGuard.getter);
    return typeof getter === "function" && Reflect.apply(getter, subject, []) === counterpart;
};

type RuleMatcher = (child: Node, parent: Node) => boolean;

const buildMethodMapping = (verb: MethodVerb, matches: RuleMatcher): ElementMapping => ({
    matches,
    attach: (child, parent) => {
        const args = resolveArgs(verb.attachArgs, child);
        if (args) callVerb(parent, verb.attach, args);
    },
    detach: (child, parent) => {
        if (!guardHolds(verb.detachGuard, child, parent)) return;
        const args = resolveArgs(verb.detachArgs, child);
        if (args) callVerb(parent, verb.detach, args);
    },
});

type ItemCollection = { getNItems(): number; getItem(position: number): unknown };

const collectionOf = (parent: GObject.Object, getter: string): ItemCollection | null => {
    const fn = Reflect.get(parent, getter);
    if (typeof fn !== "function") return null;
    const collection = Reflect.apply(fn, parent, []) as ItemCollection | null;
    if (!collection || typeof collection.getNItems !== "function" || typeof collection.getItem !== "function") {
        return null;
    }
    return collection;
};

const indexOf = (collection: ItemCollection, item: GObject.Object): number => {
    const nItems = collection.getNItems();
    for (let i = 0; i < nItems; i++) {
        if (collection.getItem(i) === item) return i;
    }
    return -1;
};

const insertPosition = (collection: ItemCollection, anchor: GObject.Object | null | undefined): number => {
    if (anchor != null) {
        const anchorIndex = indexOf(collection, anchor);
        if (anchorIndex >= 0) return anchorIndex;
    }
    return collection.getNItems();
};

const isPlacedBefore = (
    collection: ItemCollection,
    item: GObject.Object,
    anchor: GObject.Object | null | undefined,
): boolean => {
    const index = indexOf(collection, item);
    if (index < 0) return false;
    if (anchor != null) return indexOf(collection, anchor) === index + 1;
    return index === collection.getNItems() - 1;
};

type OrderedInsertState = { parent: GObject.Object };

const orderedInsertState = new WeakMap<Node, OrderedInsertState>();

const itemsFrom = (collection: ItemCollection, fromIndex: number): GObject.Object[] => {
    const items: GObject.Object[] = [];
    const nItems = collection.getNItems();
    for (let i = fromIndex; i < nItems; i++) {
        const item = collection.getItem(i);
        if (item instanceof GObject.Object) items.push(item);
    }
    return items;
};

const rerealizeTrailing = (
    verb: OrderedInsertVerb,
    parent: GObject.Object,
    collection: ItemCollection,
    afterPosition: number,
): void => {
    const following = itemsFrom(collection, afterPosition + 1);
    for (const item of following) {
        const at = indexOf(collection, item);
        if (at < 0) continue;
        callVerb(parent, verb.detach, [item]);
        callVerb(parent, verb.attach, [at, item]);
    }
};

const performOrderedInsert = (
    verb: OrderedInsertVerb,
    child: GObject.Object,
    parent: GObject.Object,
    anchor: GObject.Object | null | undefined,
): void => {
    const collection = collectionOf(parent, verb.collection);
    if (!collection) return;
    const state = orderedInsertState.get(child);
    const isMove = state?.parent === parent && indexOf(collection, child) >= 0;
    if (isMove) {
        if (isPlacedBefore(collection, child, anchor)) return;
        callVerb(parent, verb.detach, [child]);
    }
    const position = insertPosition(collection, anchor);
    callVerb(parent, verb.attach, [position, child]);
    orderedInsertState.set(child, { parent });
    if (!isMove && position < collection.getNItems() - 1) {
        rerealizeTrailing(verb, parent, collection, position);
    }
};

const buildOrderedInsertMapping = (verb: OrderedInsertVerb, matches: RuleMatcher): ElementMapping => ({
    matches,
    attach: (child, parent, anchor) => {
        if (child instanceof GObject.Object && parent instanceof GObject.Object) {
            performOrderedInsert(verb, child, parent, anchor);
        }
    },
    detach: (child, parent) => {
        if (!(child instanceof GObject.Object) || !(parent instanceof GObject.Object)) return;
        if (orderedInsertState.get(child)?.parent !== parent) return;
        callVerb(parent, verb.detach, [child]);
        orderedInsertState.delete(child);
    },
});

const buildRuleMapping = (rule: ElementMapRule): ElementMapping => {
    const matches = memoizeByGtypePair((child, parent) => ruleMatches(rule, child, parent), false);
    return rule.verb.kind === "method"
        ? buildMethodMapping(rule.verb, matches)
        : buildOrderedInsertMapping(rule.verb, matches);
};

type CompiledRule = { rule: ElementMapRule; mapping: ElementMapping };

const COMPILED_RULES: CompiledRule[] = ELEMENT_MAP.map((rule) => ({
    rule,
    mapping: buildRuleMapping(rule),
}));

export const DATA_ATTACH_MAPPINGS: ElementMapping[] = COMPILED_RULES.map(({ mapping }) => mapping);

const findCompiledRule = memoizeByGtypePair<CompiledRule | null>(
    (child, parent) => COMPILED_RULES.find(({ mapping }) => mapping.matches(child, parent)) ?? null,
    null,
);

const SETTER_PREFIX = "set";

const propertyNameForSetter = (method: string): string | null =>
    method.startsWith(SETTER_PREFIX) && method.length > SETTER_PREFIX.length
        ? toLowerFirst(method.slice(SETTER_PREFIX.length))
        : null;

const containerPropNameFor = (parent: GObject.Object, attach: string): string | null => {
    const rows = findInheritedRow(parent.__gtype__, CONTAINER_PROPS, (rowMap) =>
        Object.values(rowMap).some((row) => row.attach === attach),
    );
    if (rows === undefined) return null;
    return Object.keys(rows).find((propName) => rows[propName]?.attach === attach) ?? null;
};

const promotedPropFor = (rule: ElementMapRule, parent: Node): string | null => {
    if (rule.verb.kind !== "method" || !(parent instanceof GObject.Object)) return null;
    const attach = rule.verb.attach;
    const setterProp = propertyNameForSetter(attach);
    if (setterProp !== null) return setterProp;
    return containerPropNameFor(parent, attach);
};

const displayName = (node: Node): string => {
    const state = stateOf(node);
    if (node instanceof GObject.Object) return collectTypeNameChain(node.__gtype__)[0] ?? state.name ?? "GObject";
    return state.name ?? state.kind ?? "node";
};

export const promotedNestingGuardMapping: ElementMapping = {
    matches: memoizeByGtypePair((child, parent) => {
        const compiled = findCompiledRule(child, parent);
        return compiled !== null && promotedPropFor(compiled.rule, parent) !== null;
    }, false),
    attach: (child, parent) => {
        const compiled = findCompiledRule(child, parent);
        const prop = compiled ? promotedPropFor(compiled.rule, parent) : null;
        throw new Error(
            `<${displayName(child)}> cannot be a child of <${displayName(parent)}>: pass it through the \`${prop}\` prop instead.`,
        );
    },
    detach: () => {},
};
