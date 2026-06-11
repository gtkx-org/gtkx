/// <reference types="@gtkx/config/virtual" />

/**
 * The data-driven core of the reconciler's attach table.
 *
 * Every "attach a child to a parent through one fixed call" relationship is a
 * plain-data {@link "@gtkx/config".ElementMapRule}: the child's GLib type, the
 * parent it targets (by type or by an exposed method), and a verb naming the
 * GTK methods to call. The rows arrive merged through `virtual:gtkx-config` —
 * codegen's built-ins followed by the project's `gtkx.config.ts` `elementMap`
 * rows. A single generic interpreter turns each row into an
 * {@link "./element-map".ElementMapping}, so these relationships carry no
 * bespoke `attach`/`detach` code.
 *
 * Two verb shapes are interpreted: `method` verbs make one attach and one
 * detach call with a finite argument vocabulary; `orderedInsert` verbs place
 * the child at the anchor-derived position of a list-model collection and
 * notify {@link "./attach-events".onOrderedAttach} subscribers after every
 * mutation.
 *
 * Relationships that hold per-attachment state (slots, overlays, stack pages,
 * the widget-container fallback) stay hand-written in `element-map`; this
 * table covers the stateless verbs.
 */
import { ELEMENT_MAP } from "virtual:gtkx-config";
import type { ElementMapRule, MethodVerb, OrderedInsertVerb, VerbArgs } from "@gtkx/config";
import { notifyOrderedAttach } from "./attach-events.js";
import type { ElementMapping } from "./element-map.js";
import { collectTypeNameChain } from "./gtype.js";
import type { Instance } from "./instance.js";
import { callMethod } from "./nodes/internal/reflect-call.js";
import type { BackingInstance } from "./types.js";

/** Whether `name` appears in `instance`'s GType ancestry. */
const hasType = (instance: BackingInstance, name: string): boolean => {
    for (const typeName of collectTypeNameChain(instance.__gtype__)) {
        if (typeName === name) return true;
    }
    return false;
};

const exposesMethod = (instance: BackingInstance, method: string): boolean =>
    typeof Reflect.get(instance, method) === "function";

const ruleMatches = (rule: ElementMapRule, child: Instance, parent: Instance): boolean => {
    const childBacking = child.backingInstance;
    const parentBacking = parent.backingInstance;
    if (!childBacking || !parentBacking || !hasType(childBacking, rule.child)) return false;
    if (rule.parentType !== undefined) return hasType(parentBacking, rule.parentType);
    if (rule.parentMethod !== undefined) return exposesMethod(parentBacking, rule.parentMethod);
    return false;
};

/** Resolves a verb's argument list, or `null` when the shape cannot be satisfied. */
const resolveArgs = (shape: VerbArgs, child: Instance): readonly unknown[] | null => {
    const backing = child.backingInstance;
    switch (shape) {
        case "child":
            return [backing];
        case "null":
            return [null];
        case "childName": {
            const getName = backing && Reflect.get(backing, "getName");
            return typeof getName === "function" ? [Reflect.apply(getName, backing, [])] : null;
        }
        case "prefixChild": {
            const prefix = child.props.prefix;
            return typeof prefix === "string" ? [prefix, backing] : null;
        }
        case "prefixNull": {
            const prefix = child.props.prefix;
            return typeof prefix === "string" ? [prefix, null] : null;
        }
    }
};

const callVerb = (parent: Instance, method: string, args: readonly unknown[]): void => {
    const target = parent.backingInstance;
    if (target) callMethod(target, method, args);
};

const guardHolds = (verb: MethodVerb, child: Instance, parent: Instance): boolean => {
    const { detachGuard } = verb;
    if (!detachGuard) return true;
    const subject = detachGuard.side === "child" ? child.backingInstance : parent.backingInstance;
    const counterpart = detachGuard.side === "child" ? parent.backingInstance : child.backingInstance;
    const getter = subject && Reflect.get(subject, detachGuard.getter);
    return typeof getter === "function" && Reflect.apply(getter, subject, []) === counterpart;
};

const buildMethodMapping = (rule: ElementMapRule, verb: MethodVerb): ElementMapping => ({
    matches: (child, parent) => ruleMatches(rule, child, parent),
    attach: (child, parent) => {
        const args = resolveArgs(verb.attachArgs, child);
        if (args) callVerb(parent, verb.attach, args);
    },
    detach: (child, parent) => {
        if (!guardHolds(verb, child, parent)) return;
        const args = resolveArgs(verb.detachArgs, child);
        if (args) callVerb(parent, verb.detach, args);
    },
});

/** The duck-typed surface of a `Gio.ListModel` the ordered-insert verb reads. */
type ItemCollection = { getNItems(): number; getItem(position: number): unknown };

const collectionOf = (parent: BackingInstance, getter: string): ItemCollection | null => {
    const fn = Reflect.get(parent, getter);
    if (typeof fn !== "function") return null;
    const collection = Reflect.apply(fn, parent, []) as ItemCollection | null;
    if (!collection || typeof collection.getNItems !== "function" || typeof collection.getItem !== "function") {
        return null;
    }
    return collection;
};

const indexOf = (collection: ItemCollection, item: BackingInstance): number => {
    const nItems = collection.getNItems();
    for (let i = 0; i < nItems; i++) {
        if (collection.getItem(i) === item) return i;
    }
    return -1;
};

/**
 * The position `item` should insert at to land before `anchor`, computed
 * against the live collection that must NOT contain `item` (a move removes it
 * first): the anchor's current index, or the end when there is no anchor or
 * it is not present.
 */
const insertPosition = (collection: ItemCollection, anchor: BackingInstance | null | undefined): number => {
    if (anchor != null) {
        const anchorIndex = indexOf(collection, anchor);
        if (anchorIndex >= 0) return anchorIndex;
    }
    return collection.getNItems();
};

/**
 * Whether `item` already sits immediately before `anchor` (or last, when
 * there is no anchor) in the live collection, so a re-invoked attach can skip
 * the remove/insert.
 */
const isPlacedBefore = (
    collection: ItemCollection,
    item: BackingInstance,
    anchor: BackingInstance | null | undefined,
): boolean => {
    const index = indexOf(collection, item);
    if (index < 0) return false;
    if (anchor != null) return indexOf(collection, anchor) === index + 1;
    return index === collection.getNItems() - 1;
};

type OrderedInsertState = { parent: BackingInstance };

const buildOrderedInsertMapping = (rule: ElementMapRule, verb: OrderedInsertVerb): ElementMapping => ({
    matches: (child, parent) => ruleMatches(rule, child, parent),
    attach: (child, parent, anchor) => {
        const childBacking = child.backingInstance;
        const parentBacking = parent.backingInstance;
        if (!childBacking || !parentBacking) return;
        const collection = collectionOf(parentBacking, verb.collection);
        if (!collection) return;
        const state = child.attachState as OrderedInsertState | undefined;
        if (state?.parent === parentBacking) {
            if (isPlacedBefore(collection, childBacking, anchor)) return;
            if (indexOf(collection, childBacking) >= 0) callVerb(parent, verb.detach, [childBacking]);
        }
        callVerb(parent, verb.attach, [insertPosition(collection, anchor), childBacking]);
        child.attachState = { parent: parentBacking };
        notifyOrderedAttach(parentBacking);
    },
    detach: (child, parent) => {
        const childBacking = child.backingInstance;
        const parentBacking = parent.backingInstance;
        const state = child.attachState as OrderedInsertState | undefined;
        if (!childBacking || !parentBacking || state?.parent !== parentBacking) return;
        callVerb(parent, verb.detach, [childBacking]);
        child.attachState = undefined;
        notifyOrderedAttach(parentBacking);
    },
});

/**
 * Compiles one element-map rule into an {@link "./element-map".ElementMapping}.
 * The returned mapping's `attach`/`detach` are the generic interpreter bound
 * to the row's data, never relationship-specific code.
 *
 * @param rule - The data row to interpret.
 */
const buildRuleMapping = (rule: ElementMapRule): ElementMapping =>
    rule.verb.kind === "method" ? buildMethodMapping(rule, rule.verb) : buildOrderedInsertMapping(rule, rule.verb);

/**
 * The attach mappings compiled from the merged element-map rows delivered by
 * `virtual:gtkx-config`, in table order.
 */
export const DATA_ATTACH_MAPPINGS: readonly ElementMapping[] = ELEMENT_MAP.map(buildRuleMapping);
