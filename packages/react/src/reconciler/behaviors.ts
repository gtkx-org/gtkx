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
import { isDeepEqual } from "@gtkx/utils";
import type { DetachInfo, ElementBehavior, PlaceInfo, Props } from "./registry.js";
import { applyWrite } from "./signals.js";
import { hasSameText } from "./text.js";

type SlotHooks<P extends GObject.Object, C extends GObject.Object> = {
    attach: (parent: P, child: C, info: PlaceInfo) => unknown;
    detach?: (parent: P, child: C, info: DetachInfo) => void;
    reorder?: (parent: P, child: C, info: PlaceInfo) => unknown;
    resolve?: (parent: P, child: C) => GObject.Object | null;
};

type ValueApply<P extends GObject.Object, V> = (object: P, value: V) => void;

type ListHooks<P extends GObject.Object, I> = {
    add: (parent: P, item: I) => void;
    remove?: (parent: P, item: I) => void;
    clear?: (parent: P) => void;
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

type IndexedChildHost<C extends GObject.Object> = GObject.Object & {
    remove: (child: C) => void;
    insert: (child: C, position: number) => unknown;
};

type ChildClass<C extends GObject.Object> =
    (abstract new (...args: never[]) => C) |
    { [Symbol.hasInstance]: (value: unknown) => value is C };

const BEFORE_PARENT_DETACH: WeakSet<ElementBehavior> = new WeakSet();

const beforeParentDetach = (behavior: ElementBehavior): ElementBehavior => {
    BEFORE_PARENT_DETACH.add(behavior);

    return behavior;
};

const shouldDetachBeforeParent = (behavior: ElementBehavior): boolean => BEFORE_PARENT_DETACH.has(behavior);

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
    defaultValue?: V,
): ElementBehavior<P> => ({
    update: (object, prev, next) => {
        const nextValue = next[prop] === undefined ? defaultValue : next[prop];

        if (nextValue !== undefined && !Object.is(prev[prop], next[prop])) {
            apply(object, nextValue as V);
        }

        return [prop];
    },
});

const clearList = <P extends GObject.Object, I>(object: P, items: I[], hooks: ListHooks<P, I>): void => {
    if (hooks.clear !== undefined) {
        hooks.clear(object);

        return;
    }

    for (const item of items) {
        hooks.remove?.(object, item);
    }
};

const list = <P extends GObject.Object, I>(
    prop: string,
    hooks: ListHooks<P, I>,
): ElementBehavior<P> => {
    const behavior: ElementBehavior<P> = {
        update: (object, prev, next) => {
            const previous = (prev[prop] as I[] | null | undefined) ?? [];
            const current = (next[prop] as I[] | null | undefined) ?? [];

            if (!isDeepEqual(previous, current)) {
                clearList(object, previous, hooks);

                for (const item of current) {
                    hooks.add(object, item);
                }
            }

            return [prop];
        },
    };

    if (hooks.remove === undefined && hooks.clear === undefined) {
        behavior.constructOnly = [prop];
    }

    return behavior;
};

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

    const behavior = slot<P, C>(slotName, childClass, hooks);

    if (remove === undefined) {
        behavior.constructOnly = [slotName];
    }

    return behavior;
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

const rowSlot = <P extends Gtk.Widget & IndexedChildHost<Gtk.Widget>>(): ElementBehavior<P> =>
    slot<P, Gtk.Widget>("children", Gtk.Widget, {
        attach: (parent, child, info) => {
            parent.insert((info.adopted as Gtk.Widget | null) ?? child, info.index);
            const row = child.getParent();

            return row === parent ? child : row;
        },
        detach: (parent, _child, info) => {
            parent.remove(info.adopted as Gtk.Widget);
        },
        reorder: (parent, _child, info) => {
            const row = info.adopted as Gtk.Widget;
            parent.remove(row);
            parent.insert(row, info.index);

            return row;
        },
    });

const applicationCreator = <P extends GObject.Object & CommandLineApplication, C extends Props>(
    base: ApplicationClass<P, C>,
): ElementBehavior<P> => ({
    create: (props) => createApplication(base, props as C),
});

export {
    applicationCreator,
    beforeParentDetach,
    childMatcher,
    shouldDetachBeforeParent,
    slot,
    value,
    list,
    controlledText,
    childSetterSlot,
    contentSetterSlot,
    boxSlot,
    methodSlot,
    setterSlot,
    indexedSlot,
    rowSlot,
};
