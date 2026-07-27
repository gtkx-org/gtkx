import type * as GObject from "@gtkx/gi/gobject";
import type * as Gtk from "@gtkx/gi/gtk";
import { getInstanceType, TYPE_INVALID, typeFromName, typeIsA } from "@gtkx/runtime";
import { getOrInsert, isDeepEqual, structuredClone } from "@gtkx/utils";
import type { DetachInfo, ElementBehavior, PlaceInfo, Props } from "./registry.js";

type SlotHooks<P extends GObject.Object, C extends GObject.Object> = {
    attach: (parent: P, child: C, info: PlaceInfo) => unknown;
    detach?: (parent: P, child: C, info: DetachInfo) => void;
    reorder?: (parent: P, child: C, info: PlaceInfo) => unknown;
    resolve?: (parent: P, child: C) => GObject.Object | null;
};

type ValueApply<P extends GObject.Object, V> = (object: P, value: V) => void;

type ListHooks<P extends GObject.Object, I, H> = {
    add?: (parent: P, item: I) => H;
    remove?: (parent: P, item: I, handle: H) => void;
    clear?: (parent: P) => void;
};

type ListEntry = { item: unknown; handle: unknown };
type ListState = { snapshot: unknown[]; entries: ListEntry[] };
type DeferredState = { desired: unknown; present: boolean; applied: unknown };
type CanApply<P extends GObject.Object, V> = (object: P, value: V) => boolean;
type ChildSetter = GObject.Object & { setChild: (child: Gtk.Widget | null) => void };
type ContentSetter<C extends Gtk.Widget> = GObject.Object & { setContent: (content: C | null) => void };

type BoxLike = GObject.Object & {
    remove: (child: Gtk.Widget) => void;
    insertChildAfter: (child: Gtk.Widget, sibling: Gtk.Widget | null) => unknown;
    reorderChildAfter: (child: Gtk.Widget, sibling: Gtk.Widget | null) => void;
};

type RowCache = WeakMap<GObject.Object, Gtk.Widget>;

type IndexedInserter = GObject.Object & {
    remove: (child: Gtk.Widget) => void;
    insert: (child: Gtk.Widget, position: number) => unknown;
};

const childTypeCache: Map<string, bigint> = new Map();

const childTypeFor = (name: string): bigint => getOrInsert(childTypeCache, name, typeFromName);

const childMatcher =
    (name: string): ((child: GObject.Object) => boolean) =>
        (child) => {
            const type = childTypeFor(name);

            return type === TYPE_INVALID || typeIsA(getInstanceType(child), type);
        };

const slotAttach =
    <P extends GObject.Object, C extends GObject.Object>(
        slotName: string,
        isMatch: (child: GObject.Object) => boolean,
        attach: SlotHooks<P, C>["attach"],
    ): NonNullable<ElementBehavior["attach"]> =>
        (object, child, info) => {
            if (info.slot !== slotName || !isMatch(child)) {
                return;
            }

            return attach(object as P, child as C, info) ?? true;
        };

/** Builds a behavior for a named child slot holding children of `childType`, claiming matches only. */
const slot = <P extends GObject.Object, C extends GObject.Object>(
    slotName: string,
    childType: string,
    hooks: SlotHooks<P, C>,
): ElementBehavior => {
    const matches = childMatcher(childType);
    const { attach, detach, reorder, resolve } = hooks;
    const behavior: ElementBehavior = { attach: slotAttach(slotName, matches, attach) };

    if (reorder !== undefined) {
        behavior.reorder = (object, child, info) => reorder(object as P, child as C, info) ?? true;
    }

    if (detach !== undefined) {
        behavior.detach = (object, child, info) => {
            detach(object as P, child as C, info);
        };
    }

    if (resolve !== undefined) {
        behavior.resolve = (object, child) => resolve(object as P, child as C);
    }

    return behavior;
};

/** Builds a scalar-prop behavior that invokes `apply` whenever the value changes, and claims the prop. */
const value = <P extends GObject.Object, V>(
    prop: string,
    apply: ValueApply<P, V>,
): ElementBehavior<P> => ({
    update: (object, prev, next) => {
        if (!Object.is(prev[prop], next[prop]) && next[prop] !== undefined) {
            apply(object, next[prop] as V);
        }

        return [prop];
    },
});

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

    if (remove === undefined) {
        return;
    }

    for (const entry of entries) {
        remove(object, entry.item as I, entry.handle as H);
    }
};

/**
 * Builds an array-prop behavior that adds, removes, and clears its items, reapplying on structural
 * change. `add` may return a handle that the same item's later `remove` receives, for items whose
 * teardown needs what `add` produced (as VFL constraints need the objects the layout created).
 */
const list = <P extends GObject.Object, I, H = void>(
    prop: string,
    hooks: ListHooks<P, I, H>,
): ElementBehavior<P> => {
    const { add } = hooks;

    return {
        createContext: (): ListState => ({ snapshot: [], entries: [] }),
        update: (object, _prev, next, context) => {
            const state = context as ListState;
            const raw = next[prop];
            const items: unknown[] = Array.isArray(raw) ? raw : [];

            if (isDeepEqual(state.snapshot, items)) {
                return [prop];
            }

            teardownList(object, state.entries, hooks);
            state.entries = items.map((item) => ({ item, handle: add?.(object, item as I) }));
            state.snapshot = structuredClone(items);

            return [prop];
        },
    };
};

const flushDeferred = <P extends GObject.Object, V>(
    object: GObject.Object,
    context: unknown,
    prop: string,
    canApply: CanApply<P, V> | undefined,
): void => {
    const state = context as DeferredState;

    if (!state.present || Object.is(state.applied, state.desired)) {
        return;
    }

    if (canApply !== undefined && !canApply(object as P, state.desired as V)) {
        return;
    }

    Reflect.set(object, prop, state.desired);
    state.applied = state.desired;
};

/** Builds a behavior for a prop applied after the surrounding commit, deferred until `canApply` returns true. */
const deferred = <P extends GObject.Object, V>(
    prop: string,
    canApply?: CanApply<P, V>,
): ElementBehavior<P> => ({
    deferred: [prop],
    createContext: (): DeferredState => ({ desired: undefined, present: false, applied: undefined }),
    update: (_object, _prev, next, context) => {
        const state = context as DeferredState;
        state.desired = next[prop];
        state.present = next[prop] !== undefined;

        return [prop];
    },
    flush: (object, context) => {
        flushDeferred(object, context, prop, canApply);
    },
});

/** Builds a behavior for a text prop kept in controlled-input sync: set when provided, never reset. */
const controlledText = (prop: string): ElementBehavior =>
    value(prop, (object, next) => {
        Reflect.set(object, prop, next);
    });

/** Behavior for a container that installs its single child with `setChild`. */
const childSetterSlot = <P extends ChildSetter>(): ElementBehavior<P> =>
    slot<P, Gtk.Widget>("children", "GtkWidget", {
        attach: (parent, child) => {
            parent.setChild(child);
        },
        detach: (parent) => {
            parent.setChild(null);
        },
    });

/** Behavior for a container that installs its single child with `setContent`. */
const contentSetterSlot = <P extends ContentSetter<C>, C extends Gtk.Widget = Gtk.Widget>(
    childType = "GtkWidget",
): ElementBehavior<P> =>
    slot<P, C>("children", childType, {
        attach: (parent, child) => {
            parent.setContent(child);
        },
        detach: (parent) => {
            parent.setContent(null);
        },
    });

/** Behavior for a `GtkBox`-style container that orders children by sibling. */
const boxSlot = <P extends BoxLike>(): ElementBehavior<P> =>
    slot<P, Gtk.Widget>("children", "GtkWidget", {
        attach: (box, child, info) => box.insertChildAfter(child, info.sibling as Gtk.Widget | null),
        detach: (box, child) => {
            box.remove(child);
        },
        reorder: (box, child, info) => {
            box.reorderChildAfter(child, info.sibling as Gtk.Widget | null);
        },
    });

/** Behavior for a container whose children are added and removed by a pair of methods. */
const addRemoveSlot = <C extends GObject.Object, P extends GObject.Object>(
    slotName: string,
    childType: string,
    add: (parent: P, child: C) => unknown,
    remove: (parent: P, child: C) => void,
): ElementBehavior => slot<P, C>(slotName, childType, { attach: add, detach: remove });

/** Behavior for a `children` slot whose attach call returns the page object the container adopts. */
const adoptedChildrenSlot = <P extends GObject.Object, C extends GObject.Object>(
    childType: string,
    add: (parent: P, item: C) => unknown,
    remove: (parent: P, item: C) => void,
): ElementBehavior => addRemoveSlot<C, P>("children", childType, add, remove);

const wrappedRow = <W extends Gtk.Widget>(
    Wrapper: new (props: Props) => W,
    setChild: (wrapper: W, inner: Gtk.Widget) => void,
    rows: RowCache,
    child: Gtk.Widget,
): Gtk.Widget => {
    if (child instanceof Wrapper) {
        return child;
    }

    const existing = rows.get(child);

    if (existing !== undefined) {
        return existing;
    }

    const wrapper = new Wrapper({});
    setChild(wrapper, child);
    rows.set(child, wrapper);

    return wrapper;
};

const removeWrappedRow = (
    Wrapper: new (props: Props) => Gtk.Widget,
    parent: IndexedInserter,
    child: Gtk.Widget,
    rows: RowCache,
): void => {
    const row = child instanceof Wrapper ? child : rows.get(child);

    if (row !== undefined) {
        parent.remove(row);
    }
};

/** Behavior for an index-placed container that wraps each child in `Wrapper` before adding it. */
const wrappingIndexedSlot = <W extends Gtk.Widget, P extends IndexedInserter>(
    Wrapper: new (props: Props) => W,
    setChild: (wrapper: W, inner: Gtk.Widget) => void,
): ElementBehavior<P> => ({
    ...slot<P, Gtk.Widget>("children", "GtkWidget", {
        attach: (parent, child, info) =>
            parent.insert(wrappedRow(Wrapper, setChild, info.context as RowCache, child), info.index),
        detach: (parent, child, info) => {
            removeWrappedRow(Wrapper, parent, child, info.context as RowCache);
        },
    }),
    createContext: (): RowCache => new WeakMap(),
});

export {
    slot,
    value,
    list,
    deferred,
    controlledText,
    childSetterSlot,
    contentSetterSlot,
    boxSlot,
    addRemoveSlot,
    adoptedChildrenSlot,
    wrappingIndexedSlot,
};
