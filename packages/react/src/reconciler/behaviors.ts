import type * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import {
    type ApplicationClass,
    type CommandLineApplication,
    createApplication,
    getClassType,
    getInstanceType,
    TYPE_INVALID,
    typeIsA,
} from "@gtkx/runtime";
import { isDeepEqual, kebabCase, structuredClone, unsanitizeIdentifier } from "@gtkx/utils";
import type { DetachInfo, ElementBehavior, PlaceInfo, Props } from "./registry.js";
import { getPropertyName } from "./metadata.js";
import { applyWrite } from "./signals.js";
import { hasSameText } from "./text.js";

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
type DeferredState = { desired: unknown; isPresent: boolean; isScheduled: boolean; disconnect: (() => void) | null };
type CanApply<P extends GObject.Object, V> = (object: P, value: V) => boolean;

type DeferredOps<P extends GObject.Object, V> = {
    canApply?: CanApply<P, V> | undefined;
    parse?: ((value: unknown) => V | undefined) | undefined;
    read: (object: P) => unknown;
    write: (object: P, value: V) => void;
    signal?: string | undefined;
};

type DeferredHooks<P extends GObject.Object, V> = Omit<DeferredOps<P, V>, "read" | "write"> & {
    read?: ((object: P) => unknown) | undefined;
    write?: ((object: P, value: V) => void) | undefined;
};

type ChildSetter = GObject.Object & { setChild: (child: Gtk.Widget | null) => void };
type ContentSetter<C extends Gtk.Widget> = GObject.Object & { setContent: (content: C | null) => void };
type MatchingKey<P, F> = keyof P & string & { [K in keyof P]: P[K] extends F ? K : never }[keyof P];
type MethodKey<P, A> = MatchingKey<P, (argument: A) => unknown>;

type BoxLike = GObject.Object & {
    remove: (child: Gtk.Widget) => void;
    insertChildAfter: (child: Gtk.Widget, sibling: Gtk.Widget | null) => unknown;
    reorderChildAfter: (child: Gtk.Widget, sibling: Gtk.Widget | null) => void;
};

type RowCache = WeakMap<GObject.Object, Gtk.Widget>;

type IndexedChildHost<C extends GObject.Object> = GObject.Object & {
    remove: (child: C) => void;
    insert: (child: C, position: number) => unknown;
};

type ChildClass<C extends GObject.Object> =
    (abstract new (...args: never[]) => C) |
    { [Symbol.hasInstance]: (value: unknown) => value is C };

const childClassType = (cls: ChildClass<GObject.Object>): bigint =>
    typeof cls === "function" ? getClassType(cls) : TYPE_INVALID;

const isChildInstance = <C extends GObject.Object>(child: GObject.Object, cls: ChildClass<C>): child is C => {
    if (child instanceof cls) {
        return true;
    }

    const type = childClassType(cls);

    return type !== TYPE_INVALID && typeIsA(getInstanceType(child), type);
};

const childMatcher =
    <C extends GObject.Object>(cls: ChildClass<C> | undefined): ((child: GObject.Object) => child is C) =>
        (child): child is C =>
            cls !== undefined && isChildInstance(child, cls);

const slotAttach =
    <P extends GObject.Object, C extends GObject.Object>(
        slotName: string,
        isMatch: (child: GObject.Object) => child is C,
        attach: SlotHooks<P, C>["attach"],
    ): NonNullable<ElementBehavior["attach"]> =>
        (object, child, info) => {
            if (info.slot !== slotName || !isMatch(child)) {
                return;
            }

            return attach(object as P, child, info) ?? true;
        };

const slot = <P extends GObject.Object, C extends GObject.Object>(
    slotName: string,
    childClass: ChildClass<C> | undefined,
    hooks: SlotHooks<P, C>,
): ElementBehavior => {
    const matches = childMatcher(childClass);
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

    for (const entry of entries) {
        hooks.remove?.(object, entry.item as I, entry.handle as H);
    }
};

const listUpdate = <P extends GObject.Object, I, H>(
    prop: string,
    hooks: ListHooks<P, I, H>,
): NonNullable<ElementBehavior<P>["update"]> => {
    const { add } = hooks;

    return (object, _prev, next, context) => {
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
    };
};

const list = <P extends GObject.Object, I, H = void>(
    prop: string,
    hooks: ListHooks<P, I, H>,
): ElementBehavior<P> => {
    const behavior: ElementBehavior<P> = {
        initialize: (): ListState => ({ snapshot: [], entries: [] }),
        update: listUpdate(prop, hooks),
    };

    if (hooks.remove === undefined && hooks.clear === undefined) {
        behavior.constructOnly = [prop];
    }

    return behavior;
};

const settleDeferred = <P extends GObject.Object, V>(
    object: P,
    state: DeferredState,
    prop: string,
    ops: DeferredOps<P, V>,
): void => {
    if (!state.isPresent || Object.is(ops.read(object), state.desired)) {
        return;
    }

    const desired = state.desired as V;

    if (ops.canApply !== undefined && !ops.canApply(object, desired)) {
        return;
    }

    applyWrite(prop, () => {
        ops.write(object, desired);
    });
};

const scheduleSettle = <P extends GObject.Object, V>(
    object: P,
    state: DeferredState,
    prop: string,
    ops: DeferredOps<P, V>,
): void => {
    if (state.isScheduled) {
        return;
    }

    state.isScheduled = true;

    queueMicrotask(() => {
        state.isScheduled = false;

        if (state.disconnect !== null) {
            settleDeferred(object, state, prop, ops);
        }
    });
};

const watchDrift = <P extends GObject.Object, V>(
    object: P,
    state: DeferredState,
    prop: string,
    ops: DeferredOps<P, V>,
): void => {
    if (state.disconnect !== null) {
        return;
    }

    const signal = ops.signal ?? `notify::${getPropertyName(object, prop) ?? unsanitizeIdentifier(kebabCase(prop))}`;

    const handler = (): undefined => {
        scheduleSettle(object, state, prop, ops);
    };

    object.on(signal, handler);

    state.disconnect = (): void => {
        object.off(signal, handler);
    };
};

const deferredBehavior = <P extends GObject.Object, V>(prop: string, ops: DeferredOps<P, V>): ElementBehavior<P> => ({
    deferred: [prop],
    initialize: (): DeferredState => ({ desired: undefined, isPresent: false, isScheduled: false, disconnect: null }),
    update: (_object, _prev, next, context) => {
        const state = context as DeferredState;
        state.desired = ops.parse === undefined ? next[prop] : ops.parse(next[prop]);
        state.isPresent = state.desired !== undefined;

        return [prop];
    },
    flush: (object, context) => {
        const state = context as DeferredState;
        settleDeferred(object, state, prop, ops);
        watchDrift(object, state, prop, ops);
    },
    teardown: (_object, context) => {
        const state = context as DeferredState;
        state.disconnect?.();
        state.disconnect = null;
    },
});

const deferredWith = <P extends GObject.Object, V>(prop: string, hooks: DeferredHooks<P, V>): ElementBehavior<P> =>
    deferredBehavior<P, V>(prop, {
        ...hooks,
        read: hooks.read ?? ((object) => Reflect.get(object, prop)),
        write: hooks.write ?? ((object, value) => {
            Reflect.set(object, prop, value);
        }),
    });

const deferred = <P extends GObject.Object, V>(prop: string, canApply?: CanApply<P, V>): ElementBehavior<P> =>
    deferredWith<P, V>(prop, { canApply });

const controlledText = (prop: string): ElementBehavior =>
    value(prop, (object, next) => {
        if (!hasSameText(object, prop, next)) {
            applyWrite(prop, () => {
                Reflect.set(object, prop, next);
            });
        }
    });

const childSetterSlot = <P extends ChildSetter>(): ElementBehavior<P> =>
    slot<P, Gtk.Widget>("children", Gtk.Widget, {
        attach: (parent, child) => {
            parent.setChild(child);
        },
        detach: (parent) => {
            parent.setChild(null);
        },
    });

const contentSetterSlot = <P extends ContentSetter<C>, C extends Gtk.Widget = Gtk.Widget>(
    childClass: ChildClass<C>,
): ElementBehavior<P> =>
    slot<P, C>("children", childClass, {
        attach: (parent, child) => {
            parent.setContent(child);
        },
        detach: (parent) => {
            parent.setContent(null);
        },
    });

const boxSlot = <P extends BoxLike>(): ElementBehavior<P> =>
    slot<P, Gtk.Widget>("children", Gtk.Widget, {
        attach: (box, child, info) => box.insertChildAfter(child, info.sibling as Gtk.Widget | null),
        detach: (box, child) => {
            box.remove(child);
        },
        reorder: (box, child, info) => {
            box.reorderChildAfter(child, info.sibling as Gtk.Widget | null);
        },
    });

const callMethod = <P extends GObject.Object, A>(parent: P, method: MethodKey<P, A>, argument: A): unknown =>
    (parent[method] as (argument: A) => unknown)(argument);

const methodSlot = <P extends GObject.Object, C extends GObject.Object>(
    slotName: string,
    childClass: ChildClass<C> | undefined,
    add: MethodKey<P, C>,
    remove?: MethodKey<P, C>,
): ElementBehavior => {
    const hooks: SlotHooks<P, C> = { attach: (parent, child) => callMethod(parent, add, child) };

    if (remove !== undefined) {
        hooks.detach = (parent, child) => {
            callMethod(parent, remove, child);
        };
    }

    return slot<P, C>(slotName, childClass, hooks);
};

const setterSlot = <P extends GObject.Object, C extends GObject.Object>(
    slotName: string,
    childClass: ChildClass<C> | undefined,
    setter: MethodKey<P, C | null>,
): ElementBehavior =>
    slot<P, C>(slotName, childClass, {
        attach: (parent, child) => {
            callMethod<P, C | null>(parent, setter, child);
        },
        detach: (parent) => {
            callMethod<P, C | null>(parent, setter, null);
        },
    });

const indexedSlot = <P extends IndexedChildHost<C>, C extends GObject.Object>(
    slotName: string,
    childClass: ChildClass<C> | undefined,
): ElementBehavior<P> =>
    slot<P, C>(slotName, childClass, {
        attach: (parent, child, info) => {
            parent.insert(child, info.index);
        },
        detach: (parent, child) => {
            parent.remove(child);
        },
        reorder: (parent, child, info) => {
            parent.remove(child);
            parent.insert(child, info.index);
        },
    });

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
    parent: IndexedChildHost<Gtk.Widget>,
    child: Gtk.Widget,
    rows: RowCache,
): void => {
    const row = child instanceof Wrapper ? child : rows.get(child);

    if (row !== undefined) {
        parent.remove(row);
    }
};

const wrappingIndexedSlot = <W extends Gtk.Widget, P extends IndexedChildHost<Gtk.Widget>>(
    Wrapper: new (props: Props) => W,
    setChild: (wrapper: W, inner: Gtk.Widget) => void,
): ElementBehavior<P> => ({
    ...slot<P, Gtk.Widget>("children", Gtk.Widget, {
        attach: (parent, child, info) =>
            parent.insert(wrappedRow(Wrapper, setChild, info.context as RowCache, child), info.index),
        detach: (parent, child, info) => {
            removeWrappedRow(Wrapper, parent, child, info.context as RowCache);
        },
    }),
    initialize: (): RowCache => new WeakMap(),
});

const applicationCreator = <P extends GObject.Object & CommandLineApplication, C extends Props>(
    base: ApplicationClass<P, C>,
): ElementBehavior<P> => ({
    create: (props) => createApplication(base, props as C),
});

export {
    applicationCreator,
    childMatcher,
    slot,
    value,
    list,
    deferred,
    deferredWith,
    controlledText,
    childSetterSlot,
    contentSetterSlot,
    boxSlot,
    methodSlot,
    setterSlot,
    indexedSlot,
    wrappingIndexedSlot,
};
