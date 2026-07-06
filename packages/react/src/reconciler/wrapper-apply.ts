import { CONTAINER_SLOT_KIND, type ContainerProp, LAZY_ELEMENT_KIND, WIDGET_PROP_KIND } from "@gtkx/config";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { applyProps } from "./apply-props.js";
import { attachChild, detachChild, getFocusWidget, isDescendantOf, unparentWidget } from "./container-attach.js";
import {
    adoptRuleFor,
    type CallScope,
    nullSetterCurrentHolder,
    resolveAttachRule,
    runCall,
    runCallValue,
} from "./rule-table.js";
import { type ElementMapping, isWrapperKind, type Node, registeredStateOf, registerState, stateOf } from "./state.js";
import type { Props } from "./types.js";
import { trackedInstance, trackedWidget, wrapperChildInstances } from "./wrapper-content.js";

const attachedParent = new WeakMap<GObject.Object, GObject.Object>();

const scopeFor = (child: GObject.Object, extra?: Partial<CallScope>): CallScope => ({
    child,
    props: stateOf(child).props,
    ...extra,
});

const runRemove = (parent: GObject.Object, child: GObject.Object, rule: ContainerProp): void => {
    if (rule.remove !== undefined) runCall(parent, rule.remove, [child], scopeFor(child));
};

const collectRuleSiblings = (parent: GObject.Object, rule: ContainerProp): GObject.Object[] => {
    const siblings: GObject.Object[] = [];
    for (const sibling of stateOf(parent).children) {
        if (!(sibling instanceof GObject.Object) || sibling instanceof Gtk.Widget) continue;
        if (resolveAttachRule(parent.__type__, sibling.__type__, undefined) === rule) siblings.push(sibling);
    }
    return siblings;
};

const insertRuleChildAt = (parent: GObject.Object, child: GObject.Object, rule: ContainerProp, index: number): void => {
    if (rule.insert !== undefined && runCall(parent, rule.insert, [child, index], scopeFor(child, { index }))) {
        attachedParent.set(child, parent);
    }
};

export const attachRuleChild = (
    parent: GObject.Object,
    child: GObject.Object,
    rule: ContainerProp,
    anchor: GObject.Object | null | undefined,
): void => {
    const isMove = attachedParent.get(child) === parent;
    if (rule.insert !== undefined && (anchor != null || isMove)) {
        if (isMove) runRemove(parent, child, rule);
        const siblings = collectRuleSiblings(parent, rule);
        const index = siblings.indexOf(child);
        insertRuleChildAt(parent, child, rule, index);
        if (!isMove) {
            for (const trailing of siblings.slice(index + 1)) {
                runRemove(parent, trailing, rule);
                insertRuleChildAt(parent, trailing, rule, siblings.indexOf(trailing));
            }
        }
        return;
    }
    if (isMove) return;
    if (rule.append !== undefined && runCall(parent, rule.append, [child], scopeFor(child))) {
        attachedParent.set(child, parent);
    }
};

export const detachRuleChild = (parent: GObject.Object, child: GObject.Object, rule: ContainerProp): void => {
    if (attachedParent.get(child) !== parent) return;
    const holder = rule.remove !== undefined ? nullSetterCurrentHolder(parent, rule.remove) : undefined;
    if (holder === undefined || holder === child) runRemove(parent, child, rule);
    attachedParent.delete(child);
};

const resolveFor = (child: Node, parent: Node): ContainerProp | null => {
    if (!(child instanceof GObject.Object) || child instanceof Gtk.Widget) return null;
    if (!(parent instanceof GObject.Object)) return null;
    return resolveAttachRule(parent.__type__, child.__type__, undefined);
};

export const ruleChildMapping: ElementMapping = {
    matches: (child, parent) => resolveFor(child, parent) !== null,
    attach: (child, parent, anchor) => {
        const rule = resolveFor(child, parent);
        if (rule === null || !(parent instanceof GObject.Object) || !(child instanceof GObject.Object)) return;
        attachRuleChild(parent, child, rule, anchor);
    },
    detach: (child, parent) => {
        const rule = resolveFor(child, parent);
        if (rule === null || !(parent instanceof GObject.Object) || !(child instanceof GObject.Object)) return;
        detachRuleChild(parent, child, rule);
    },
};

export const attachSlotChild = (parent: GObject.Object, child: GObject.Object, slot: string): boolean => {
    const rule = resolveAttachRule(parent.__type__, child.__type__, slot);
    if (rule === null) return false;
    attachRuleChild(parent, child, rule, null);
    return true;
};

export const detachSlotChild = (parent: GObject.Object, child: GObject.Object, slot: string): void => {
    const rule = resolveAttachRule(parent.__type__, child.__type__, slot);
    if (rule !== null) detachRuleChild(parent, child, rule);
};

const isRooted = (instance: GObject.Object): boolean =>
    instance instanceof Gtk.Widget ? instance.getRoot() !== null : true;

const rescueFocus = (parent: GObject.Object, child: GObject.Object | undefined): void => {
    if (!(parent instanceof Gtk.Widget) || !(child instanceof Gtk.Widget)) return;
    const focus = getFocusWidget(child);
    if (focus && isDescendantOf(focus, child)) parent.grabFocus();
};

type WidgetPropState = { prop: string; value: GObject.Object };

const widgetPropState = new WeakMap<Node, WidgetPropState>();

export const widgetPropMapping: ElementMapping = {
    matches: (child, parent) => isWrapperKind(child, WIDGET_PROP_KIND) && parent instanceof GObject.Object,
    attach: (child, parent) => {
        const childState = stateOf(child);
        const prop = childState.props.propName;
        if (typeof prop !== "string" || !(parent instanceof GObject.Object)) return;
        const value = trackedInstance(child);
        const state = widgetPropState.get(child);
        if (state && state.value === value) return;
        Reflect.set(parent, prop, value ?? null);
        if (value) widgetPropState.set(child, { prop, value });
        else widgetPropState.delete(child);
    },
    detach: (child, parent) => {
        const state = widgetPropState.get(child);
        widgetPropState.delete(child);
        if (!state || !(parent instanceof GObject.Object) || !isRooted(parent)) return;
        rescueFocus(parent, state.value);
        Reflect.set(parent, state.prop, null);
    },
};

const sameInstances = (a: Node[], b: Node[]): boolean =>
    a.length === b.length && a.every((instance, index) => instance === b[index]);

const slotTagOf = (node: Node): string | undefined => {
    const slotTag = stateOf(node).props.slotTag;
    return typeof slotTag === "string" ? slotTag : undefined;
};

const containerSlotState = new WeakMap<Node, Node[]>();

const detachContainerSlotChild = (instance: Node, parent: GObject.Object, slotTag: string): void => {
    if (instance instanceof GObject.Object) detachSlotChild(parent, instance, slotTag);
    if (instance instanceof Gtk.Widget && instance.getParent() !== null) unparentWidget(instance);
};

export const containerSlotMapping: ElementMapping = {
    matches: (child, parent) => isWrapperKind(child, CONTAINER_SLOT_KIND) && parent instanceof GObject.Object,
    attach: (child, parent) => {
        const slotTag = slotTagOf(child);
        if (slotTag === undefined || !(parent instanceof GObject.Object)) return;
        const desired = wrapperChildInstances(child);
        const prev = containerSlotState.get(child) ?? [];
        if (sameInstances(prev, desired)) return;
        for (const instance of prev) detachContainerSlotChild(instance, parent, slotTag);
        for (const instance of desired) {
            if (instance instanceof GObject.Object) attachSlotChild(parent, instance, slotTag);
        }
        containerSlotState.set(child, desired);
    },
    detach: (child, parent) => {
        const slotTag = slotTagOf(child);
        const instances = containerSlotState.get(child) ?? [];
        containerSlotState.delete(child);
        if (slotTag === undefined || !(parent instanceof GObject.Object)) return;
        for (const instance of instances) detachContainerSlotChild(instance, parent, slotTag);
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
        if (isWrapperKind(sibling, LAZY_ELEMENT_KIND)) ordinal++;
    }
    return ordinal;
};

const appendLazyContent = (
    parent: GObject.Object,
    rule: ContainerProp,
    node: Node,
    content: Gtk.Widget,
): GObject.Object | undefined => {
    const ordinal = rule.insert !== undefined ? lazyOrdinal(parent, node) : null;
    let appended: unknown;
    if (rule.insert !== undefined && ordinal !== null) {
        appended = runCallValue(parent, rule.insert, [content, ordinal], {
            child: content,
            index: ordinal,
            props: stateOf(node).props,
        }).value;
    } else if (rule.append !== undefined) {
        appended = runCallValue(parent, rule.append, [content], { child: content, props: stateOf(node).props }).value;
    } else {
        attachChild(content, parent);
    }
    const accessor = typeof rule.adopt === "string" ? rule.adopt : undefined;
    const acquired =
        accessor !== undefined ? runCallValue(parent, accessor, [content], { child: content }).value : appended;
    return acquired instanceof GObject.Object ? acquired : undefined;
};

const applyLazyProps = (state: LazyState, node: Node): void => {
    if (state.instance === null) return;
    const built = lazyPropsOf(stateOf(node).props);
    applyProps(state.instance, state.appliedProps, built, {});
    state.appliedProps = built;
};

const releaseLazyContent = (node: Node, state: LazyState, parent: GObject.Object, rule: ContainerProp): void => {
    const { content, instance } = state;
    if (instance !== null) {
        registeredStateOf(instance)?.signalStore.clear(instance);
        stateOf(node).adoptedInstance = undefined;
    }
    state.instance = null;
    state.appliedProps = {};
    if (content !== null) {
        if (rule.remove !== undefined) {
            const stillInside =
                !(parent instanceof Gtk.Widget) || (content.getParent() !== null && isDescendantOf(content, parent));
            if (stillInside) runCall(parent, rule.remove, [content], { child: content });
        } else {
            detachChild(content, parent);
        }
    }
    state.content = null;
};

const syncLazyElement = (parent: GObject.Object, rule: ContainerProp, node: Node): void => {
    const state = lazyState.get(node) ?? freshLazyState();
    lazyState.set(node, state);
    const content = trackedWidget(node);
    if (state.content !== null && state.content !== content) releaseLazyContent(node, state, parent, rule);
    if (content === null) return;
    if (state.instance === null) {
        const instance = appendLazyContent(parent, rule, node, content);
        state.content = content;
        if (instance !== undefined) {
            state.instance = instance;
            stateOf(node).adoptedInstance = instance;
            if (!registeredStateOf(instance)) {
                registerState(instance, { props: {}, rootContainer: stateOf(node).rootContainer });
            }
        }
    }
    applyLazyProps(state, node);
};

export const lazyElementMapping: ElementMapping = {
    matches: (child, parent) =>
        isWrapperKind(child, LAZY_ELEMENT_KIND) &&
        parent instanceof GObject.Object &&
        adoptRuleFor(parent.__type__) !== null,
    attach: (child, parent) => {
        if (!(parent instanceof GObject.Object)) return;
        const rule = adoptRuleFor(parent.__type__);
        if (rule === null) return;
        syncLazyElement(parent, rule, child);
    },
    detach: (child, parent) => {
        const state = lazyState.get(child);
        lazyState.delete(child);
        if (!state || !(parent instanceof GObject.Object)) return;
        const rule = adoptRuleFor(parent.__type__);
        if (rule === null) return;
        releaseLazyContent(child, state, parent, rule);
    },
};
