import type * as GObject from "@gtkx/gi/gobject";
import type * as Gtk from "@gtkx/gi/gtk";
import {
    type AnyClass,
    type ApplicationClass,
    coerceObjectProperty,
    type CommandLineApplication,
    createApplication,
    getClassType,
    TYPE_INVALID,
    typeFromName,
    typeIsA,
} from "@gtkx/runtime";
import { getOrInsert, isDeepEqual, kebabCase, structuredClone, unsanitizeIdentifier } from "@gtkx/utils";
import type { DetachInfo, ElementBehavior, PlaceInfo, Props } from "./registry.js";
import { runWithErrorReporter } from "./commit-errors.js";
import { getPropertyName } from "./metadata.js";
import { applyMutation, applyWrite } from "./signals.js";
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
    rollback?: (parent: P, item: I) => void;
};

type ListEntry = { item: unknown; handle: unknown };
type ListState = { snapshot: unknown[]; entries: ListEntry[] };
type ListReplacement = { items: unknown[]; snapshot: unknown[] };

type DeferredState = {
    desired: unknown;
    isPresent: boolean;
    isScheduled: boolean;
    disconnect: (() => void) | null;
    reportError: ((error: unknown) => void) | null;
};

type DeferredValueByKind = { boolean: boolean; integer: number; string: string | null };
type DeferredValueKind = keyof DeferredValueByKind;
type DeferredValueGuard = (value: unknown) => boolean;
type CanApply<P extends GObject.Object, V> = (object: P, value: V) => boolean;
type ChildSetter = GObject.Object & { setChild: (child: Gtk.Widget | null) => void };
type ContentSetter<C extends Gtk.Widget> = GObject.Object & { setContent: (content: C | null) => void };

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

const childTypeCache: Map<string, bigint> = new Map();

const deferredValueGuards: Record<DeferredValueKind, DeferredValueGuard> = {
    boolean: (value) => typeof value === "boolean",
    integer: (value) => Number.isSafeInteger(value),
    string: (value) => value === null || typeof value === "string",
};

const childTypeFor = (name: string): bigint => getOrInsert(childTypeCache, name, typeFromName);

const childMatcher =
    (name: string): ((child: GObject.Object) => boolean) =>
        (child) => {
            const type = childTypeFor(name);

            return type === TYPE_INVALID || typeIsA(getClassType(child.constructor as AnyClass), type);
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

const value = <P extends GObject.Object, V>(
    prop: string,
    apply: ValueApply<P, V>,
): ElementBehavior<P> => ({
    update: (object, prev, next) => {
        if (!Object.is(prev[prop], next[prop]) && next[prop] !== undefined) {
            applyMutation(() => {
                apply(object, next[prop] as V);
            });
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

const addListEntries = <P extends GObject.Object, I, H>(
    object: P,
    items: unknown[],
    hooks: ListHooks<P, I, H>,
    entries: ListEntry[],
): void => {
    for (const item of items) {
        try {
            const handle = hooks.add?.(object, item as I);
            entries.push({ item, handle });
        } catch (error) {
            hooks.rollback?.(object, item as I);
            throw error;
        }
    }
};

const restoreList = <P extends GObject.Object, I, H>(
    object: P,
    previous: ListEntry[],
    hooks: ListHooks<P, I, H>,
    state: ListState,
): void => {
    const restored: ListEntry[] = [];
    addListEntries(object, previous.map(({ item }) => item), hooks, restored);
    state.entries = restored;
};

const replaceList = <P extends GObject.Object, I, H>(
    object: P,
    replacement: ListReplacement,
    hooks: ListHooks<P, I, H>,
    state: ListState,
): void => {
    const previous = state.entries;
    const entries: ListEntry[] = [];
    teardownList(object, previous, hooks);

    try {
        addListEntries(object, replacement.items, hooks, entries);
    } catch (error) {
        teardownList(object, entries, hooks);
        restoreList(object, previous, hooks, state);
        throw error;
    }

    state.entries = entries;
    state.snapshot = replacement.snapshot;
};

const listItems = (prop: string, value: unknown): unknown[] => {
    if (value === undefined || value === null) {
        return [];
    }

    if (!Array.isArray(value)) {
        throw new TypeError(`The '${prop}' prop must be an array, null, or undefined`);
    }

    return value;
};

const listUpdate = <P extends GObject.Object, I, H>(
    prop: string,
    hooks: ListHooks<P, I, H>,
): NonNullable<ElementBehavior<P>["update"]> => {
    return (object, _prev, next, context) => {
        const state = context as ListState;
        const raw = next[prop];
        const items = listItems(prop, raw);

        if (isDeepEqual(state.snapshot, items)) {
            return [prop];
        }

        const snapshot = structuredClone(items);

        applyMutation(() => {
            replaceList(object, { items, snapshot }, hooks, state);
        });

        return [prop];
    };
};

const list = <P extends GObject.Object, I, H = void>(
    prop: string,
    hooks: ListHooks<P, I, H>,
): ElementBehavior<P> => {
    const behavior: ElementBehavior<P> = {
        initialize: (): ListState => ({ snapshot: [], entries: [] }),
        validate: (_object, _prev, next) => {
            listItems(prop, next[prop]);
        },
        update: listUpdate(prop, hooks),
    };

    if (hooks.remove === undefined && hooks.clear === undefined) {
        behavior.constructOnly = [prop];
    }

    return behavior;
};

const settleDeferred = <P extends GObject.Object, V>(
    object: GObject.Object,
    state: DeferredState,
    prop: string,
    canApply: CanApply<P, V> | undefined,
): void => {
    if (!state.isPresent || Object.is(Reflect.get(object, prop), state.desired)) {
        return;
    }

    if (canApply !== undefined && !canApply(object as P, state.desired as V)) {
        return;
    }

    applyWrite(prop, () => {
        Reflect.set(object, prop, state.desired);
    });
};

const scheduleSettle = <P extends GObject.Object, V>(
    object: GObject.Object,
    state: DeferredState,
    prop: string,
    canApply: CanApply<P, V> | undefined,
): void => {
    if (state.isScheduled) {
        return;
    }

    state.isScheduled = true;

    queueMicrotask(() => {
        state.isScheduled = false;

        if (state.disconnect !== null) {
            runWithErrorReporter(state.reportError, () => {
                settleDeferred(object, state, prop, canApply);
            });
        }
    });
};

const watchDrift = <P extends GObject.Object, V>(
    object: GObject.Object,
    state: DeferredState,
    prop: string,
    canApply: CanApply<P, V> | undefined,
): void => {
    if (state.disconnect !== null) {
        return;
    }

    const signal = `notify::${getPropertyName(object, prop) ?? unsanitizeIdentifier(kebabCase(prop))}`;

    const handler = (): undefined => {
        scheduleSettle(object, state, prop, canApply);
    };

    object.on(signal, handler);

    state.disconnect = (): void => {
        object.off(signal, handler);
    };
};

const normalizeDeferred = <K extends DeferredValueKind>(
    object: GObject.Object,
    prop: string,
    value: unknown,
    kind: K,
): DeferredValueByKind[K] => {
    const normalized = coerceObjectProperty(object, prop, value);

    if (!deferredValueGuards[kind](normalized)) {
        throw new TypeError(`The '${prop}' prop must be a ${kind}`);
    }

    return normalized as DeferredValueByKind[K];
};

const initializeDeferred = (): DeferredState => ({
    desired: undefined,
    isPresent: false,
    isScheduled: false,
    disconnect: null,
    reportError: null,
});

const validateDeferred = <P extends GObject.Object>(
    prop: string,
    kind: DeferredValueKind,
): NonNullable<ElementBehavior<P>["validate"]> =>
    (object, _prev, next) => {
        const value = next[prop];

        if (value !== undefined && (value !== null || kind === "string")) {
            normalizeDeferred(object, prop, value, kind);
        }
    };

const updateDeferred = <P extends GObject.Object>(
    prop: string,
    kind: DeferredValueKind,
): NonNullable<ElementBehavior<P>["update"]> =>
    (object, _prev, next, context) => {
        const state = context as DeferredState;
        const value = next[prop];

        if (value === undefined || (value === null && kind !== "string")) {
            state.desired = undefined;
            state.isPresent = false;
        } else {
            state.desired = normalizeDeferred(object, prop, value, kind);
            state.isPresent = true;
        }

        return [prop];
    };

const flushDeferred = <P extends GObject.Object, K extends DeferredValueKind>(
    prop: string,
    canApply: CanApply<P, DeferredValueByKind[K]> | undefined,
): NonNullable<ElementBehavior<P>["flush"]> =>
    (object, context, reportError) => {
        const state = context as DeferredState;
        state.reportError = reportError;
        settleDeferred(object, state, prop, canApply);
        watchDrift(object, state, prop, canApply);
    };

const teardownDeferred = (_object: GObject.Object, context: unknown): void => {
    const state = context as DeferredState;
    state.disconnect?.();
    state.disconnect = null;
    state.reportError = null;
};

const deferred = <P extends GObject.Object, K extends DeferredValueKind>(
    prop: string,
    kind: K,
    canApply?: CanApply<P, DeferredValueByKind[K]>,
): ElementBehavior<P> => ({
    deferred: [prop],
    initialize: initializeDeferred,
    validate: validateDeferred(prop, kind),
    update: updateDeferred(prop, kind),
    flush: flushDeferred(prop, canApply),
    teardown: teardownDeferred,
});

const controlledText = (prop: string): ElementBehavior => ({
    update: (object, prev, next) => {
        if (Object.is(prev[prop], next[prop]) || next[prop] === undefined) {
            return [prop];
        }

        const value = next[prop];

        if (!hasSameText(object, prop, value)) {
            applyWrite(prop, () => {
                Reflect.set(object, prop, value);
            });
        }

        return [prop];
    },
});

const childSetterSlot = <P extends ChildSetter>(): ElementBehavior<P> =>
    slot<P, Gtk.Widget>("children", "GtkWidget", {
        attach: (parent, child) => {
            parent.setChild(child);
        },
        detach: (parent) => {
            parent.setChild(null);
        },
    });

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

const addRemoveSlot = <C extends GObject.Object, P extends GObject.Object>(
    slotName: string,
    childType: string,
    add: (parent: P, child: C) => unknown,
    remove: (parent: P, child: C) => void,
): ElementBehavior => slot<P, C>(slotName, childType, { attach: add, detach: remove });

const indexedSlot = <P extends IndexedChildHost<C>, C extends GObject.Object>(
    slotName: string,
    childType: string,
): ElementBehavior<P> =>
    slot<P, C>(slotName, childType, {
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
    ...slot<P, Gtk.Widget>("children", "GtkWidget", {
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
    controlledText,
    childSetterSlot,
    contentSetterSlot,
    boxSlot,
    addRemoveSlot,
    adoptedChildrenSlot,
    indexedSlot,
    wrappingIndexedSlot,
};
