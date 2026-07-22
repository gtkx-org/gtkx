import type { ContainerProp } from "@gtkx/config";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { isSameArray } from "@gtkx/utils";
import { isDescendantOf, unparentWidget } from "./container-attach.js";
import { type CallScope, resolveContainerProp, resolveCurrentHolder, runCall } from "./element-props.js";
import { type ElementMapping, hasWrapperKind, type Node, stateOf } from "./state.js";
import { collectWrapperChildInstances, trackedInstanceOf } from "./wrapper-content.js";
import { CONTAINER_PROP_KIND, OBJECT_PROP_KIND } from "./wrapper-kinds.js";

const attachedParent = new WeakMap<GObject.Object, GObject.Object>();

const buildScope = (child: GObject.Object, extra?: Partial<CallScope>): CallScope => ({
    child,
    props: stateOf(child).props,
    ...extra,
});

const runRemove = (parent: GObject.Object, child: GObject.Object, cp: ContainerProp): void => {
    if (cp.remove !== undefined) runCall(parent, cp.remove, [child], buildScope(child));
};

const collectContainerSiblings = (parent: GObject.Object, cp: ContainerProp): GObject.Object[] => {
    const siblings: GObject.Object[] = [];
    for (const sibling of stateOf(parent).children) {
        if (!(sibling instanceof GObject.Object) || sibling instanceof Gtk.Widget) continue;
        if (resolveContainerProp(parent.__type__, sibling.__type__, undefined) === cp) siblings.push(sibling);
    }
    return siblings;
};

const insertContainerChildAt = (
    parent: GObject.Object,
    child: GObject.Object,
    cp: ContainerProp,
    index: number,
): void => {
    if (cp.insert !== undefined && runCall(parent, cp.insert, [child, index], buildScope(child, { index }))) {
        attachedParent.set(child, parent);
    }
};

const attachContainerChild = (
    parent: GObject.Object,
    child: GObject.Object,
    cp: ContainerProp,
    anchor: GObject.Object | null | undefined,
): void => {
    const isMove = attachedParent.get(child) === parent;
    if (cp.insert !== undefined && (anchor != null || isMove)) {
        if (isMove) runRemove(parent, child, cp);
        const siblings = collectContainerSiblings(parent, cp);
        const index = siblings.indexOf(child);
        insertContainerChildAt(parent, child, cp, index);
        if (!isMove) {
            for (const trailing of siblings.slice(index + 1)) {
                runRemove(parent, trailing, cp);
                insertContainerChildAt(parent, trailing, cp, siblings.indexOf(trailing));
            }
        }
        return;
    }
    if (isMove) return;
    if (cp.append !== undefined && runCall(parent, cp.append, [child], buildScope(child))) {
        attachedParent.set(child, parent);
    }
};

const detachContainerChild = (parent: GObject.Object, child: GObject.Object, cp: ContainerProp): void => {
    if (attachedParent.get(child) !== parent) return;
    const holder = cp.remove !== undefined ? resolveCurrentHolder(parent, cp.remove) : undefined;
    if (holder === undefined || holder === child) runRemove(parent, child, cp);
    attachedParent.delete(child);
};

type ContainerChildMatch = { child: GObject.Object; parent: GObject.Object; cp: ContainerProp };

const resolveContainerChild = (child: Node, parent: Node): ContainerChildMatch | null => {
    if (!(child instanceof GObject.Object) || child instanceof Gtk.Widget) return null;
    if (!(parent instanceof GObject.Object)) return null;
    const cp = resolveContainerProp(parent.__type__, child.__type__, undefined);
    return cp === null ? null : { child, parent, cp };
};

export const containerChildMapping: ElementMapping = (child, parent) => {
    const match = resolveContainerChild(child, parent);
    if (match === null) return null;
    return {
        attach: (anchor) => attachContainerChild(match.parent, match.child, match.cp, anchor),
        detach: () => detachContainerChild(match.parent, match.child, match.cp),
    };
};

const attachPropChild = (parent: GObject.Object, child: GObject.Object, propName: string): void => {
    const cp = resolveContainerProp(parent.__type__, child.__type__, propName);
    if (cp !== null) attachContainerChild(parent, child, cp, null);
};

const detachPropChild = (parent: GObject.Object, child: GObject.Object, propName: string): void => {
    const cp = resolveContainerProp(parent.__type__, child.__type__, propName);
    if (cp !== null) detachContainerChild(parent, child, cp);
};

const isRooted = (instance: GObject.Object): boolean =>
    instance instanceof Gtk.Widget ? instance.getRoot() !== null : true;

const rescueFocus = (parent: GObject.Object, child: GObject.Object | undefined): void => {
    if (!(parent instanceof Gtk.Widget) || !(child instanceof Gtk.Widget)) return;
    const focus = child.getRoot()?.getFocus() ?? null;
    if (focus && isDescendantOf(focus, child)) parent.grabFocus();
};

type ObjectPropState = { prop: string; value: GObject.Object };

const objectPropState = new WeakMap<Node, ObjectPropState>();

export const objectPropMapping: ElementMapping = (child, parent) => {
    if (!hasWrapperKind(child, OBJECT_PROP_KIND) || !(parent instanceof GObject.Object)) return null;
    return {
        attach: () => {
            const prop = propNameOf(child);
            if (prop === undefined) return;
            const value = trackedInstanceOf(child);
            const state = objectPropState.get(child);
            if (state && state.value === value) return;
            Reflect.set(parent, prop, value ?? null);
            if (value) objectPropState.set(child, { prop, value });
            else objectPropState.delete(child);
        },
        detach: () => {
            const state = objectPropState.get(child);
            objectPropState.delete(child);
            if (!state || !isRooted(parent)) return;
            rescueFocus(parent, state.value);
            Reflect.set(parent, state.prop, null);
        },
    };
};

const propNameOf = (node: Node): string | undefined => {
    const propName = stateOf(node).props.propName;
    return typeof propName === "string" ? propName : undefined;
};

const containerPropState = new WeakMap<Node, GObject.Object[]>();

const detachContainerPropChild = (instance: GObject.Object, parent: GObject.Object, propName: string): void => {
    detachPropChild(parent, instance, propName);
    if (instance instanceof Gtk.Widget && instance.getParent() !== null) unparentWidget(instance);
};

export const containerPropMapping: ElementMapping = (child, parent) => {
    if (!hasWrapperKind(child, CONTAINER_PROP_KIND) || !(parent instanceof GObject.Object)) return null;
    return {
        attach: () => {
            const propName = propNameOf(child);
            if (propName === undefined) return;
            const desired = collectWrapperChildInstances(child);
            const prev = containerPropState.get(child) ?? [];
            if (isSameArray(prev, desired)) return;
            for (const instance of prev) detachContainerPropChild(instance, parent, propName);
            for (const instance of desired) attachPropChild(parent, instance, propName);
            containerPropState.set(child, desired);
        },
        detach: () => {
            const propName = propNameOf(child);
            const instances = containerPropState.get(child) ?? [];
            containerPropState.delete(child);
            if (propName === undefined) return;
            for (const instance of instances) detachContainerPropChild(instance, parent, propName);
        },
    };
};
