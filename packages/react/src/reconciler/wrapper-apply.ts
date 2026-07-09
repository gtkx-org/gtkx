import type { ContainerProp } from "@gtkx/config";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { applyProps } from "./apply-props.js";
import { attachChild, detachChild, getFocusWidget, isDescendantOf, unparentWidget } from "./container-attach.js";
import {
    adoptContainerPropFor,
    type CallScope,
    nullSetterCurrentHolder,
    resolveContainerProp,
    runCall,
    runCallValue,
} from "./element-props.js";
import { type ElementMapping, hasWrapperKind, type Node, registeredStateOf, registerState, stateOf } from "./state.js";
import type { Props } from "./types.js";
import { trackedInstance, trackedWidget, wrapperChildInstances } from "./wrapper-content.js";
import { CONTAINER_PROP_KIND, LAZY_ELEMENT_KIND, OBJECT_PROP_KIND } from "./wrapper-protocol.js";

const attachedParent = new WeakMap<GObject.Object, GObject.Object>();

const scopeFor = (child: GObject.Object, extra?: Partial<CallScope>): CallScope => ({
    child,
    props: stateOf(child).props,
    ...extra,
});

const runRemove = (parent: GObject.Object, child: GObject.Object, cp: ContainerProp): void => {
    if (cp.remove !== undefined) runCall(parent, cp.remove, [child], scopeFor(child));
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
    if (cp.insert !== undefined && runCall(parent, cp.insert, [child, index], scopeFor(child, { index }))) {
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
    if (cp.append !== undefined && runCall(parent, cp.append, [child], scopeFor(child))) {
        attachedParent.set(child, parent);
    }
};

const detachContainerChild = (parent: GObject.Object, child: GObject.Object, cp: ContainerProp): void => {
    if (attachedParent.get(child) !== parent) return;
    const holder = cp.remove !== undefined ? nullSetterCurrentHolder(parent, cp.remove) : undefined;
    if (holder === undefined || holder === child) runRemove(parent, child, cp);
    attachedParent.delete(child);
};

const resolveFor = (child: Node, parent: Node): ContainerProp | null => {
    if (!(child instanceof GObject.Object) || child instanceof Gtk.Widget) return null;
    if (!(parent instanceof GObject.Object)) return null;
    return resolveContainerProp(parent.__type__, child.__type__, undefined);
};

export const containerChildMapping: ElementMapping = {
    matches: (child, parent) => resolveFor(child, parent) !== null,
    attach: (child, parent, anchor) => {
        const cp = resolveFor(child, parent);
        if (cp === null || !(parent instanceof GObject.Object) || !(child instanceof GObject.Object)) return;
        attachContainerChild(parent, child, cp, anchor);
    },
    detach: (child, parent) => {
        const cp = resolveFor(child, parent);
        if (cp === null || !(parent instanceof GObject.Object) || !(child instanceof GObject.Object)) return;
        detachContainerChild(parent, child, cp);
    },
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
    const focus = getFocusWidget(child);
    if (focus && isDescendantOf(focus, child)) parent.grabFocus();
};

type ObjectPropState = { prop: string; value: GObject.Object };

const objectPropState = new WeakMap<Node, ObjectPropState>();

export const objectPropMapping: ElementMapping = {
    matches: (child, parent) => hasWrapperKind(child, OBJECT_PROP_KIND) && parent instanceof GObject.Object,
    attach: (child, parent) => {
        const childState = stateOf(child);
        const prop = childState.props.propName;
        if (typeof prop !== "string" || !(parent instanceof GObject.Object)) return;
        const value = trackedInstance(child);
        const state = objectPropState.get(child);
        if (state && state.value === value) return;
        Reflect.set(parent, prop, value ?? null);
        if (value) objectPropState.set(child, { prop, value });
        else objectPropState.delete(child);
    },
    detach: (child, parent) => {
        const state = objectPropState.get(child);
        objectPropState.delete(child);
        if (!state || !(parent instanceof GObject.Object) || !isRooted(parent)) return;
        rescueFocus(parent, state.value);
        Reflect.set(parent, state.prop, null);
    },
};

const sameInstances = (a: Node[], b: Node[]): boolean =>
    a.length === b.length && a.every((instance, index) => instance === b[index]);

const propNameOf = (node: Node): string | undefined => {
    const propName = stateOf(node).props.propName;
    return typeof propName === "string" ? propName : undefined;
};

const containerPropState = new WeakMap<Node, Node[]>();

const detachContainerPropChild = (instance: Node, parent: GObject.Object, propName: string): void => {
    if (instance instanceof GObject.Object) detachPropChild(parent, instance, propName);
    if (instance instanceof Gtk.Widget && instance.getParent() !== null) unparentWidget(instance);
};

export const containerPropMapping: ElementMapping = {
    matches: (child, parent) => hasWrapperKind(child, CONTAINER_PROP_KIND) && parent instanceof GObject.Object,
    attach: (child, parent) => {
        const propName = propNameOf(child);
        if (propName === undefined || !(parent instanceof GObject.Object)) return;
        const desired = wrapperChildInstances(child);
        const prev = containerPropState.get(child) ?? [];
        if (sameInstances(prev, desired)) return;
        for (const instance of prev) detachContainerPropChild(instance, parent, propName);
        for (const instance of desired) {
            if (instance instanceof GObject.Object) attachPropChild(parent, instance, propName);
        }
        containerPropState.set(child, desired);
    },
    detach: (child, parent) => {
        const propName = propNameOf(child);
        const instances = containerPropState.get(child) ?? [];
        containerPropState.delete(child);
        if (propName === undefined || !(parent instanceof GObject.Object)) return;
        for (const instance of instances) detachContainerPropChild(instance, parent, propName);
    },
};

type LazyState = { content: Gtk.Widget | null; instance: GObject.Object | null; appliedProps: Props };

const lazyState = new WeakMap<Node, LazyState>();

const freshLazyState = (): LazyState => ({ content: null, instance: null, appliedProps: {} });

const RESERVED_LAZY_PROPS = new Set(["children", "ref", "key", "kind"]);

const lazyPropsOf = (nodeProps: Props): Props => {
    const built: Props = {};
    for (const [name, value] of Object.entries(nodeProps)) {
        if (RESERVED_LAZY_PROPS.has(name)) continue;
        built[name] = value;
    }
    return built;
};

const lazyOrdinal = (parent: Node, node: Node): number => {
    let ordinal = 0;
    for (const sibling of stateOf(parent).children) {
        if (sibling === node) return ordinal;
        if (hasWrapperKind(sibling, LAZY_ELEMENT_KIND)) ordinal++;
    }
    return ordinal;
};

const appendLazyContent = (
    parent: GObject.Object,
    cp: ContainerProp,
    node: Node,
    content: Gtk.Widget,
): GObject.Object | undefined => {
    const ordinal = cp.insert !== undefined ? lazyOrdinal(parent, node) : null;
    let appended: unknown;
    if (cp.insert !== undefined && ordinal !== null) {
        appended = runCallValue(parent, cp.insert, [content, ordinal], {
            child: content,
            index: ordinal,
            props: stateOf(node).props,
        }).value;
    } else if (cp.append !== undefined) {
        appended = runCallValue(parent, cp.append, [content], { child: content, props: stateOf(node).props }).value;
    } else {
        attachChild(content, parent);
    }
    const accessor = typeof cp.adopt === "string" ? cp.adopt : undefined;
    const acquired =
        accessor !== undefined ? runCallValue(parent, accessor, [content], { child: content }).value : appended;
    return acquired instanceof GObject.Object ? acquired : undefined;
};

const applyAdoptedProps = (state: LazyState, node: Node): void => {
    if (state.instance === null) return;
    const built = lazyPropsOf(stateOf(node).props);
    applyProps(state.instance, state.appliedProps, built, {});
    state.appliedProps = built;
};

const releaseLazyContent = (node: Node, state: LazyState, parent: GObject.Object, cp: ContainerProp): void => {
    const { content, instance } = state;
    if (instance !== null) {
        registeredStateOf(instance)?.signalStore.clear(instance);
        stateOf(node).adoptedInstance = undefined;
    }
    state.instance = null;
    state.appliedProps = {};
    if (content !== null) {
        if (cp.remove !== undefined) {
            const stillInside =
                !(parent instanceof Gtk.Widget) || (content.getParent() !== null && isDescendantOf(content, parent));
            if (stillInside) runCall(parent, cp.remove, [content], { child: content });
        } else {
            detachChild(content, parent);
        }
    }
    state.content = null;
};

const syncLazyElement = (parent: GObject.Object, cp: ContainerProp, node: Node): void => {
    const state = lazyState.get(node) ?? freshLazyState();
    lazyState.set(node, state);
    const content = trackedWidget(node);
    if (state.content !== null && state.content !== content) releaseLazyContent(node, state, parent, cp);
    if (content === null) return;
    if (state.instance === null) {
        const instance = appendLazyContent(parent, cp, node, content);
        state.content = content;
        if (instance !== undefined) {
            state.instance = instance;
            stateOf(node).adoptedInstance = instance;
            if (!registeredStateOf(instance)) {
                registerState(instance, { props: {}, rootContainer: stateOf(node).rootContainer });
            }
        }
    }
    applyAdoptedProps(state, node);
};

export const lazyElementMapping: ElementMapping = {
    matches: (child, parent) =>
        hasWrapperKind(child, LAZY_ELEMENT_KIND) &&
        parent instanceof GObject.Object &&
        adoptContainerPropFor(parent.__type__) !== null,
    attach: (child, parent) => {
        if (!(parent instanceof GObject.Object)) return;
        const cp = adoptContainerPropFor(parent.__type__);
        if (cp === null) return;
        syncLazyElement(parent, cp, child);
    },
    detach: (child, parent) => {
        const state = lazyState.get(child);
        lazyState.delete(child);
        if (!state || !(parent instanceof GObject.Object)) return;
        const cp = adoptContainerPropFor(parent.__type__);
        if (cp === null) return;
        releaseLazyContent(child, state, parent, cp);
    },
};
