import type * as GObject from "@gtkx/gi/gobject";
import type * as Gtk from "@gtkx/gi/gtk";
import { getInstanceType, TYPE_INVALID, typeFromName, typeIsA } from "@gtkx/runtime";
import { getOrInsert, isDeepEqual, structuredClone } from "@gtkx/utils";
import type { DetachInfo, ElementBehavior, PlaceInfo, Props } from "./registry.js";

const childTypeCache: Map<string, bigint> = new Map();

const childTypeOf = (name: string): bigint => getOrInsert(childTypeCache, name, typeFromName);

const childMatcher =
    (name: string): ((child: GObject.Object) => boolean) =>
        (child) => {
            const type = childTypeOf(name);
            return type === TYPE_INVALID || typeIsA(getInstanceType(child), type);
        };

type SlotHooks<P extends GObject.Object, C extends GObject.Object> = {
    attach: (parent: P, child: C, info: PlaceInfo) => unknown;
    detach?: (parent: P, child: C, info: DetachInfo) => void;
    reorder?: (parent: P, child: C, info: PlaceInfo) => unknown;
    resolve?: (parent: P, child: C) => GObject.Object | null;
};

/** Builds a behavior for a named child slot holding children of `childType`, claiming matches only. */
export const slot = <P extends GObject.Object, C extends GObject.Object>(
    slotName: string,
    childType: string,
    hooks: SlotHooks<P, C>,
): ElementBehavior => {
    const matches = childMatcher(childType);
    const { attach, detach, reorder, resolve } = hooks;
    const behavior: ElementBehavior = {
        attach: (object, child, info) =>
            info.slot === slotName && matches(child) ? (attach(object as P, child as C, info) ?? true) : undefined,
    };
    if (reorder !== undefined)
        behavior.reorder = (object, child, info) => reorder(object as P, child as C, info) ?? true;
    if (detach !== undefined)
        behavior.detach = (object, child, info) => {
            detach(object as P, child as C, info);
        };
    if (resolve !== undefined) behavior.resolve = (object, child) => resolve(object as P, child as C);
    return behavior;
};

/** Builds a scalar-prop behavior that invokes `apply` whenever the value changes, and claims the prop. */
export const value = <P extends GObject.Object, V>(
    prop: string,
    apply: (object: P, value: V) => void,
): ElementBehavior => ({
    update: (object, prev, next) => {
        if (!Object.is(prev[prop], next[prop]) && next[prop] !== undefined) apply(object as P, next[prop] as V);
        return [prop];
    },
});

type ListHooks<P extends GObject.Object, I, H> = {
    add?: (parent: P, item: I) => H;
    remove?: (parent: P, item: I, handle: H) => void;
    clear?: (parent: P) => void;
};

type ListEntry = { item: unknown; handle: unknown };
type ListState = { snapshot: unknown[]; entries: ListEntry[] };

const teardownList = <P extends GObject.Object, I, H>(
    object: P,
    entries: ListEntry[],
    hooks: ListHooks<P, I, H>,
): void => {
    if (hooks.clear !== undefined) {
        hooks.clear(object);
        return;
    }
    const remove = hooks.remove;
    if (remove === undefined) return;
    for (const entry of entries) remove(object, entry.item as I, entry.handle as H);
};

/**
 * Builds an array-prop behavior that adds, removes, and clears its items, reapplying on structural
 * change. `add` may return a handle that the same item's later `remove` receives, for items whose
 * teardown needs what `add` produced (as VFL constraints need the objects the layout created).
 */
export const list = <P extends GObject.Object, I, H = void>(
    prop: string,
    hooks: ListHooks<P, I, H>,
): ElementBehavior => {
    const { add } = hooks;
    return {
        createContext: (): ListState => ({ snapshot: [], entries: [] }),
        update: (object, _prev, next, context) => {
            const state = context as ListState;
            const raw = next[prop];
            const items = Array.isArray(raw) ? raw : [];
            if (isDeepEqual(state.snapshot, items)) return [prop];
            teardownList(object as P, state.entries, hooks);
            state.entries = items.map((item) => ({ item, handle: add?.(object as P, item as I) }));
            state.snapshot = structuredClone(items);
            return [prop];
        },
    };
};

type DeferredState = { desired: unknown; present: boolean; applied: unknown };

const flushDeferred = <P extends GObject.Object, V>(
    object: GObject.Object,
    context: unknown,
    prop: string,
    canApply: ((object: P, value: V) => boolean) | undefined,
): void => {
    const state = context as DeferredState;
    if (!state.present || Object.is(state.applied, state.desired)) return;
    if (canApply !== undefined && !canApply(object as P, state.desired as V)) return;
    Reflect.set(object, prop, state.desired);
    state.applied = state.desired;
};

/** Builds a behavior for a prop applied after the surrounding commit, deferred until `canApply` returns true. */
export const deferred = <P extends GObject.Object, V>(
    prop: string,
    canApply?: (object: P, value: V) => boolean,
): ElementBehavior => ({
    deferred: [prop],
    createContext: (): DeferredState => ({ desired: undefined, present: false, applied: undefined }),
    update: (_object, _prev, next, context) => {
        const state = context as DeferredState;
        state.desired = next[prop];
        state.present = next[prop] !== undefined;
        return [prop];
    },
    flush: (object, context) => flushDeferred(object, context, prop, canApply),
});

/** Builds a behavior for a text prop kept in controlled-input sync: set when provided, never reset. */
export const controlledText = (prop: string): ElementBehavior =>
    value(prop, (object, next) => {
        Reflect.set(object, prop, next);
    });

/** Behavior for a container that installs its single child with `setChild`. */
export const childSetterSlot = <
    P extends GObject.Object & { setChild: (child: Gtk.Widget | null) => void },
>(): ElementBehavior =>
    slot<P, Gtk.Widget>("children", "GtkWidget", {
        attach: (parent, child) => parent.setChild(child),
        detach: (parent) => parent.setChild(null),
    });

/** Behavior for a container that installs its single child with `setContent`. */
export const contentSetterSlot = <
    P extends GObject.Object & { setContent: (content: C | null) => void },
    C extends Gtk.Widget = Gtk.Widget,
>(
    childType = "GtkWidget",
): ElementBehavior =>
    slot<P, C>("children", childType, {
        attach: (parent, child) => parent.setContent(child),
        detach: (parent) => parent.setContent(null),
    });

/** Behavior for a `GtkBox`-style container that orders children by sibling. */
export const boxSlot = <
    P extends GObject.Object & {
        remove: (child: Gtk.Widget) => void;
        insertChildAfter: (child: Gtk.Widget, sibling: Gtk.Widget | null) => unknown;
        reorderChildAfter: (child: Gtk.Widget, sibling: Gtk.Widget | null) => void;
    },
>(): ElementBehavior =>
    slot<P, Gtk.Widget>("children", "GtkWidget", {
        attach: (box, child, info) => box.insertChildAfter(child, info.sibling as Gtk.Widget | null),
        detach: (box, child) => box.remove(child),
        reorder: (box, child, info) => box.reorderChildAfter(child, info.sibling as Gtk.Widget | null),
    });

/** Behavior for a container whose children are added and removed by a pair of methods. */
export const addRemoveSlot = <C extends GObject.Object, P extends GObject.Object>(
    slotName: string,
    childType: string,
    add: (parent: P, child: C) => unknown,
    remove: (parent: P, child: C) => void,
): ElementBehavior => slot<P, C>(slotName, childType, { attach: add, detach: remove });

/** Behavior for a `children` slot whose attach call returns the page object the container adopts. */
export const adoptedChildrenSlot = <P extends GObject.Object, C extends GObject.Object>(
    childType: string,
    add: (parent: P, item: C) => unknown,
    remove: (parent: P, item: C) => void,
): ElementBehavior => addRemoveSlot<C, P>("children", childType, add, remove);

type RowCache = WeakMap<GObject.Object, Gtk.Widget>;

/** Behavior for an index-placed container that wraps each child in `Wrapper` before adding it. */
export const wrappingIndexedSlot = <
    W extends Gtk.Widget,
    P extends GObject.Object & {
        remove: (child: Gtk.Widget) => void;
        insert: (child: Gtk.Widget, position: number) => unknown;
    },
>(
    Wrapper: new (props: Props) => W,
    setChild: (wrapper: W, inner: Gtk.Widget) => void,
): ElementBehavior => {
    const rowFor = (rows: RowCache, child: Gtk.Widget): Gtk.Widget => {
        if (child instanceof Wrapper) return child;
        const existing = rows.get(child);
        if (existing !== undefined) return existing;
        const wrapper = new Wrapper({});
        setChild(wrapper, child);
        rows.set(child, wrapper);
        return wrapper;
    };
    return {
        ...slot<P, Gtk.Widget>("children", "GtkWidget", {
            attach: (parent, child, info) => parent.insert(rowFor(info.context as RowCache, child), info.index),
            detach: (parent, child, info) => {
                const row = child instanceof Wrapper ? child : (info.context as RowCache).get(child);
                if (row !== undefined) parent.remove(row);
            },
        }),
        createContext: (): RowCache => new WeakMap(),
    };
};
