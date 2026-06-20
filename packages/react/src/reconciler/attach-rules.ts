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
 * {@link "./element-mapping".ElementMapping}, so these relationships carry no
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
import { CONTAINER_PROPS, ELEMENT_MAP } from "virtual:gtkx-config";
import type { ElementMapRule, MethodVerb, OrderedInsertVerb, VerbArgs } from "@gtkx/config";
import * as GObject from "@gtkx/gi/gobject";
import { toLowerFirst } from "@gtkx/utils";
import { collectTypeNameChain, findInheritedRow } from "../utils/gtype.js";
import { hasType } from "../utils/gtype-predicates.js";
import { notifyOrderedAttach } from "./attach-events.js";
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

/**
 * Memoizes a `(child, parent)` predicate or lookup by the pair's backing
 * GTypes. A rule match depends only on the GType ancestries and the methods a
 * backing class's prototype exposes, all fixed per GType, so a pair's result
 * never changes once computed. Pairs missing a backing instance resolve to
 * `absent` and are never cached.
 *
 * @param compute - the per-pair computation to memoize
 * @param absent - the value returned when either side has no backing instance
 */
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

/** Resolves a verb's argument list, or `null` when the shape cannot be satisfied. */
const resolveArgs = (shape: VerbArgs, child: Node): readonly unknown[] | null => {
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
            const prefix = stateOf(child).props.prefix;
            return typeof prefix === "string" ? [prefix, child] : null;
        }
        case "prefixNull": {
            const prefix = stateOf(child).props.prefix;
            return typeof prefix === "string" ? [prefix, null] : null;
        }
    }
};

const callVerb = (parent: Node, method: string, args: readonly unknown[]): void => {
    if (parent instanceof GObject.Object) callMethod(parent, method, args);
};

const guardHolds = (verb: MethodVerb, child: Node, parent: Node): boolean => {
    const { detachGuard } = verb;
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
        if (!guardHolds(verb, child, parent)) return;
        const args = resolveArgs(verb.detachArgs, child);
        if (args) callVerb(parent, verb.detach, args);
    },
});

/** The duck-typed surface of a `Gio.ListModel` the ordered-insert verb reads. */
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

/**
 * The position `item` should insert at to land before `anchor`, computed
 * against the live collection that must NOT contain `item` (a move removes it
 * first): the anchor's current index, or the end when there is no anchor or
 * it is not present.
 */
const insertPosition = (collection: ItemCollection, anchor: GObject.Object | null | undefined): number => {
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

const buildOrderedInsertMapping = (verb: OrderedInsertVerb, matches: RuleMatcher): ElementMapping => ({
    matches,
    attach: (child, parent, anchor) => {
        if (!(child instanceof GObject.Object) || !(parent instanceof GObject.Object)) return;
        const collection = collectionOf(parent, verb.collection);
        if (!collection) return;
        const state = orderedInsertState.get(child);
        if (state?.parent === parent) {
            if (isPlacedBefore(collection, child, anchor)) return;
            if (indexOf(collection, child) >= 0) callVerb(parent, verb.detach, [child]);
        }
        callVerb(parent, verb.attach, [insertPosition(collection, anchor), child]);
        orderedInsertState.set(child, { parent });
        notifyOrderedAttach(parent);
    },
    detach: (child, parent) => {
        if (!(child instanceof GObject.Object) || !(parent instanceof GObject.Object)) return;
        if (orderedInsertState.get(child)?.parent !== parent) return;
        callVerb(parent, verb.detach, [child]);
        orderedInsertState.delete(child);
        notifyOrderedAttach(parent);
    },
});

/**
 * Compiles one element-map rule into an {@link "./element-mapping".ElementMapping}.
 * The returned mapping's `attach`/`detach` are the generic interpreter bound
 * to the row's data, never relationship-specific code; its `matches` is the
 * row predicate memoized per GType pair through {@link memoizeByGtypePair}.
 *
 * @param rule - The data row to interpret.
 */
const buildRuleMapping = (rule: ElementMapRule): ElementMapping => {
    const matches = memoizeByGtypePair((child, parent) => ruleMatches(rule, child, parent), false);
    return rule.verb.kind === "method"
        ? buildMethodMapping(rule.verb, matches)
        : buildOrderedInsertMapping(rule.verb, matches);
};

type CompiledRule = { readonly rule: ElementMapRule; readonly mapping: ElementMapping };

const COMPILED_RULES: readonly CompiledRule[] = ELEMENT_MAP.map((rule) => ({
    rule,
    mapping: buildRuleMapping(rule),
}));

/**
 * The attach mappings compiled from the merged element-map rows delivered by
 * `virtual:gtkx-config`, in table order.
 */
export const DATA_ATTACH_MAPPINGS: readonly ElementMapping[] = COMPILED_RULES.map(({ mapping }) => mapping);

const findCompiledRule = memoizeByGtypePair<CompiledRule | null>(
    (child, parent) => COMPILED_RULES.find(({ mapping }) => mapping.matches(child, parent)) ?? null,
    null,
);

/**
 * The first compiled element-map rule whose row matches the `(child, parent)`
 * pair, or `undefined` when none does. The container-slot interpreter uses
 * this to attach and detach a slot's GObject children through the row's verbs
 * (`addController`/`removeController`, …) instead of widget unparenting.
 *
 * @param child - The child node being attached or detached.
 * @param parent - The parent node it targets.
 */
export const findDataAttachMapping = (child: Node, parent: Node): ElementMapping | undefined =>
    findCompiledRule(child, parent)?.mapping;

const SETTER_PREFIX = "set";

const propertyNameForSetter = (method: string): string | null =>
    method.startsWith(SETTER_PREFIX) && method.length > SETTER_PREFIX.length
        ? toLowerFirst(method.slice(SETTER_PREFIX.length))
        : null;

/**
 * The slot or container-slot prop that covers `rule` on `parent`, or `null`
 * when the relationship has no prop surface. A `set<Prop>` attach method writes
 * a GObject-class property, which is always a value-driven slot, so it promotes
 * to that `<prop>` (e.g. `setBuffer` → `buffer`, `setLayoutManager` →
 * `layoutManager`). Any other attach method promotes only when it is a declared
 * container-slot method on `parent`; add/insert methods that are not (e.g.
 * `AdwToggleGroup.add`) have no prop surface and keep attaching as children.
 */
const promotedPropFor = (rule: ElementMapRule, parent: Node): string | null => {
    if (rule.verb.kind !== "method" || !(parent instanceof GObject.Object)) return null;
    const attach = rule.verb.attach;
    const setterProp = propertyNameForSetter(attach);
    if (setterProp !== null) return setterProp;
    return findInheritedRow(parent.__gtype__, CONTAINER_PROPS, (methods) => methods.includes(attach)) !== undefined
        ? attach
        : null;
};

const displayName = (node: Node): string => {
    const state = stateOf(node);
    if (node instanceof GObject.Object) return collectTypeNameChain(node.__gtype__)[0] ?? state.name ?? "GObject";
    return state.name ?? state.kind ?? "node";
};

/**
 * Rejects direct child nesting for relationships promoted to slot or
 * container-slot props. Placed ahead of the data-rule mappings in the element
 * map, it matches exactly when a data rule would attach the pair AND a prop
 * covers that rule on the parent, and throws an error naming the prop.
 * Relationships without a prop surface (an add/insert method that is not a
 * declared container slot, such as `AdwToggleGroup.add`) keep attaching as
 * children.
 */
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
