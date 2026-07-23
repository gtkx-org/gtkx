import type { ContainerProp } from "@gtkx/config";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { pickBy } from "@gtkx/utils";
import { applyProps } from "./apply-props.js";
import { attachChild, detachChild, isDescendantOf } from "./container-attach.js";
import { resolveAdoptContainerProp, runCall, runCallValue } from "./element-props.js";
import { type ElementMapping, hasWrapperKind, type Node, registeredStateOf, registerState, stateOf } from "./state.js";
import type { Props } from "./types.js";
import { trackedWidgetOf } from "./wrapper-content.js";
import { ELEMENT_KIND } from "./wrapper-kinds.js";

type LazyState = { content: Gtk.Widget | null; instance: GObject.Object | null; appliedProps: Props; ordinal: number };

const lazyState = new WeakMap<Node, LazyState>();

const createLazyState = (): LazyState => ({ content: null, instance: null, appliedProps: {}, ordinal: -1 });

const RESERVED_LAZY_PROPS = new Set(["children", "ref", "key", "kind"]);

const lazyPropsOf = (nodeProps: Props): Props => pickBy(nodeProps, (_value, name) => !RESERVED_LAZY_PROPS.has(name));

const resolveLazyOrdinal = (parent: Node, node: Node): number => {
    let ordinal = 0;
    for (const sibling of stateOf(parent).children) {
        if (sibling === node) return ordinal;
        if (hasWrapperKind(sibling, ELEMENT_KIND)) ordinal++;
    }
    return ordinal;
};

const appendLazyContent = (
    parent: GObject.Object,
    cp: ContainerProp,
    node: Node,
    content: Gtk.Widget,
): GObject.Object | undefined => {
    let appended: unknown;
    if (cp.insert !== undefined) {
        const ordinal = resolveLazyOrdinal(parent, node);
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
            if (stillInside) runCall(parent, cp.remove, [content], { child: content, adopted: instance ?? undefined });
        } else {
            detachChild(content, parent);
        }
    }
    state.content = null;
};

const syncLazyElement = (parent: GObject.Object, cp: ContainerProp, node: Node): void => {
    const state = lazyState.get(node) ?? createLazyState();
    lazyState.set(node, state);
    const content = trackedWidgetOf(node);
    if (state.content !== null && state.content !== content) releaseLazyContent(node, state, parent, cp);
    if (content === null) return;
    if (state.instance === null) {
        const instance = appendLazyContent(parent, cp, node, content);
        state.content = content;
        state.ordinal = resolveLazyOrdinal(parent, node);
        if (instance !== undefined) {
            state.instance = instance;
            stateOf(node).adoptedInstance = instance;
            if (!registeredStateOf(instance)) {
                registerState(instance, { props: {}, rootContainer: stateOf(node).rootContainer });
            }
        }
    } else if (cp.reorder !== undefined) {
        const ordinal = resolveLazyOrdinal(parent, node);
        if (ordinal !== state.ordinal) {
            runCall(parent, cp.reorder, [content, ordinal], {
                child: content,
                index: ordinal,
                adopted: state.instance ?? undefined,
            });
            state.ordinal = ordinal;
        }
    }
    applyAdoptedProps(state, node);
};

export const lazyElementMapping: ElementMapping = (child, parent) => {
    if (!hasWrapperKind(child, ELEMENT_KIND) || !(parent instanceof GObject.Object)) return null;
    const cp = resolveAdoptContainerProp(parent.__type__);
    if (cp === null) return null;
    return {
        attach: () => syncLazyElement(parent, cp, child),
        detach: () => {
            const state = lazyState.get(child);
            lazyState.delete(child);
            if (!state) return;
            releaseLazyContent(child, state, parent, cp);
        },
    };
};
