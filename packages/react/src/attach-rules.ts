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
import { CONTAINER_SLOTS, ELEMENT_MAP } from "virtual:gtkx-config";
import type { ElementMapRule, MethodVerb, OrderedInsertVerb, VerbArgs } from "@gtkx/config";
import type { GType } from "@gtkx/gi/gobject";
import { notifyOrderedAttach } from "./attach-events.js";
import type { ElementMapping } from "./element-mapping.js";
import { collectTypeNameChain, typeChainIncludes } from "./gtype.js";
import type { Instance } from "./instance.js";
import { callMethod } from "./nodes/internal/reflect-call.js";
import type { BackingInstance } from "./types.js";

/** Whether `name` appears in `instance`'s GType ancestry. */
const hasType = (instance: BackingInstance, name: string): boolean => typeChainIncludes(instance.__gtype__, name);

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
const memoizeByGTypePair = <T>(
    compute: (child: Instance, parent: Instance) => T,
    absent: T,
): ((child: Instance, parent: Instance) => T) => {
    const cache = new Map<GType, Map<GType, T>>();
    return (child, parent) => {
        const childType = child.backingInstance?.__gtype__;
        const parentType = parent.backingInstance?.__gtype__;
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

type RuleMatcher = (child: Instance, parent: Instance) => boolean;

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

const buildOrderedInsertMapping = (verb: OrderedInsertVerb, matches: RuleMatcher): ElementMapping => ({
    matches,
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
 * Compiles one element-map rule into an {@link "./element-mapping".ElementMapping}.
 * The returned mapping's `attach`/`detach` are the generic interpreter bound
 * to the row's data, never relationship-specific code; its `matches` is the
 * row predicate memoized per GType pair through {@link memoizeByGTypePair}.
 *
 * @param rule - The data row to interpret.
 */
const buildRuleMapping = (rule: ElementMapRule): ElementMapping => {
    const matches = memoizeByGTypePair((child, parent) => ruleMatches(rule, child, parent), false);
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

const findCompiledRule = memoizeByGTypePair<CompiledRule | null>(
    (child, parent) => COMPILED_RULES.find(({ mapping }) => mapping.matches(child, parent)) ?? null,
    null,
);

/**
 * The first compiled element-map rule whose row matches the `(child, parent)`
 * pair, or `undefined` when none does. The container-slot interpreter uses
 * this to attach and detach a slot's GObject children through the row's verbs
 * (`addController`/`removeController`, …) instead of widget unparenting.
 *
 * @param child - The child instance being attached or detached.
 * @param parent - The parent instance it targets.
 */
export const findDataAttachMapping = (child: Instance, parent: Instance): ElementMapping | undefined =>
    findCompiledRule(child, parent)?.mapping;

const SETTER_PREFIX = "set";

const propertyNameForSetter = (method: string): string | null =>
    method.startsWith(SETTER_PREFIX) && method.length > SETTER_PREFIX.length
        ? method.charAt(SETTER_PREFIX.length).toLowerCase() + method.slice(SETTER_PREFIX.length + 1)
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
const promotedPropFor = (rule: ElementMapRule, parent: Instance): string | null => {
    if (rule.verb.kind !== "method") return null;
    const backing = parent.backingInstance;
    if (!backing) return null;
    const attach = rule.verb.attach;
    const setterProp = propertyNameForSetter(attach);
    if (setterProp !== null) return setterProp;
    for (const typeName of collectTypeNameChain(backing.__gtype__)) {
        if (CONTAINER_SLOTS[typeName]?.includes(attach)) return attach;
    }
    return null;
};

const displayName = (instance: Instance): string =>
    instance.backingInstance
        ? (collectTypeNameChain(instance.backingInstance.__gtype__)[0] ?? instance.type)
        : instance.type;

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
    matches: memoizeByGTypePair((child, parent) => {
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
