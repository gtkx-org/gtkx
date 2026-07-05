import { type AttachRule, COMPANION_KIND, CONTAINER_SLOT_KIND, type CompanionRule, WIDGET_PROP_KIND } from "@gtkx/config";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { callMethod } from "@gtkx/utils";
import { collectTypeNameChain } from "../utils/gtype.js";
import { applyProps } from "./apply-props.js";
import { attachChild, detachChild, getFocusWidget, isDescendantOf, unparentWidget } from "./container-attach.js";
import {
    type CallScope,
    elementRuleFor,
    nullSetterCurrentHolder,
    resolveAttachRule,
    runCall,
    runCallValue,
} from "./rule-table.js";
import { type ElementMapping, isWrapperKind, type Node, registeredStateOf, registerState, stateOf } from "./state.js";
import type { Props } from "./types.js";
import { trackedInstance, trackedWidget, wrapperChildInstances, wrapperChildWidgets } from "./wrapper-content.js";

const attachedParent = new WeakMap<GObject.Object, GObject.Object>();

const scopeFor = (child: GObject.Object, extra?: Partial<CallScope>): CallScope => ({
    child,
    props: stateOf(child).props,
    ...extra,
});

const runRemove = (parent: GObject.Object, child: GObject.Object, rule: AttachRule): void => {
    if (rule.remove !== undefined) runCall(parent, rule.remove, [child], scopeFor(child));
};

const collectRuleSiblings = (parent: GObject.Object, rule: AttachRule): GObject.Object[] => {
    const siblings: GObject.Object[] = [];
    for (const sibling of stateOf(parent).children) {
        if (!(sibling instanceof GObject.Object) || sibling instanceof Gtk.Widget) continue;
        const resolved = resolveAttachRule(parent.__type__, sibling.__type__, undefined);
        if (resolved?.kind === "attach" && resolved.rule === rule) siblings.push(sibling);
    }
    return siblings;
};

const insertRuleChildAt = (parent: GObject.Object, child: GObject.Object, rule: AttachRule, index: number): void => {
    if (rule.insert !== undefined && runCall(parent, rule.insert, [child, index], scopeFor(child, { index }))) {
        attachedParent.set(child, parent);
    }
};

export const attachRuleChild = (
    parent: GObject.Object,
    child: GObject.Object,
    rule: AttachRule,
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
    if (rule.add !== undefined && runCall(parent, rule.add, [child], scopeFor(child))) {
        attachedParent.set(child, parent);
    }
};

export const detachRuleChild = (parent: GObject.Object, child: GObject.Object, rule: AttachRule): void => {
    if (attachedParent.get(child) !== parent) return;
    const holder = rule.remove !== undefined ? nullSetterHolderOf(parent, rule) : undefined;
    if (holder === undefined || holder === child) runRemove(parent, child, rule);
    attachedParent.delete(child);
};

const nullSetterHolderOf = (parent: GObject.Object, rule: AttachRule): unknown => {
    if (rule.remove === undefined) return undefined;
    return nullSetterCurrentHolder(parent, rule.remove);
};

const displayName = (node: Node): string => {
    const state = stateOf(node);
    if (node instanceof GObject.Object) return collectTypeNameChain(node.__type__)[0] ?? state.name ?? "GObject";
    return state.name ?? state.kind ?? "node";
};

const resolveFor = (child: Node, parent: Node) => {
    if (!(child instanceof GObject.Object) || child instanceof Gtk.Widget) return null;
    if (!(parent instanceof GObject.Object)) return null;
    return resolveAttachRule(parent.__type__, child.__type__, undefined);
};

export const ruleChildMapping: ElementMapping = {
    matches: (child, parent) => resolveFor(child, parent) !== null,
    attach: (child, parent, anchor) => {
        const resolved = resolveFor(child, parent);
        if (resolved === null || !(parent instanceof GObject.Object) || !(child instanceof GObject.Object)) return;
        if (resolved.kind === "reject") {
            throw new Error(
                `<${displayName(child)}> cannot be a child of <${displayName(parent)}>: pass it through the \`${resolved.rule.prop}\` prop instead.`,
            );
        }
        attachRuleChild(parent, child, resolved.rule, anchor);
    },
    detach: (child, parent) => {
        const resolved = resolveFor(child, parent);
        if (resolved === null || resolved.kind !== "attach") return;
        if (!(parent instanceof GObject.Object) || !(child instanceof GObject.Object)) return;
        detachRuleChild(parent, child, resolved.rule);
    },
};

export const attachSlotChild = (parent: GObject.Object, child: GObject.Object, slot: string): boolean => {
    const resolved = resolveAttachRule(parent.__type__, child.__type__, slot);
    if (resolved?.kind !== "attach") return false;
    attachRuleChild(parent, child, resolved.rule, null);
    return true;
};

export const detachSlotChild = (parent: GObject.Object, child: GObject.Object, slot: string): void => {
    const resolved = resolveAttachRule(parent.__type__, child.__type__, slot);
    if (resolved?.kind === "attach") detachRuleChild(parent, child, resolved.rule);
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

type CompanionSync = {
    contents: Gtk.Widget[];
    companions: Map<Gtk.Widget, GObject.Object>;
    appliedProps: Props;
    appliedSetters: Map<Gtk.Widget, Map<string, unknown>>;
};

const companionState = new WeakMap<Node, CompanionSync>();

const freshCompanionSync = (): CompanionSync => ({
    contents: [],
    companions: new Map(),
    appliedProps: {},
    appliedSetters: new Map(),
});

const companionRuleOf = (node: Node): CompanionRule | null => {
    const element = stateOf(node).props.element;
    if (typeof element !== "string") return null;
    return elementRuleFor(element) ?? null;
};

const RESERVED_COMPANION_PROPS = new Set(["children", "ref", "key", "kind", "element"]);

const companionPropsOf = (rule: CompanionRule, nodeProps: Props): Props => {
    const setters = rule.setters;
    const built: Props = {};
    for (const [name, value] of Object.entries(nodeProps)) {
        if (RESERVED_COMPANION_PROPS.has(name)) continue;
        if (setters !== undefined && name in setters) continue;
        built[name] = value;
    }
    return built;
};

const acquireCompanion = (
    parent: GObject.Object,
    rule: CompanionRule,
    content: Gtk.Widget,
    addResult: unknown,
): GObject.Object | undefined => {
    if (rule.companion !== undefined) {
        const result = runCallValue(parent, rule.companion, [content], { child: content });
        return result.value instanceof GObject.Object ? result.value : undefined;
    }
    return addResult instanceof GObject.Object ? addResult : undefined;
};

const adoptCompanion = (node: Node, companion: GObject.Object): void => {
    const nodeState = stateOf(node);
    nodeState.adoptedInstance = companion;
    if (!registeredStateOf(companion)) registerState(companion, { props: {}, rootContainer: nodeState.rootContainer });
};

const releaseAdopted = (node: Node): void => {
    const nodeState = stateOf(node);
    const adopted = nodeState.adoptedInstance;
    nodeState.adoptedInstance = undefined;
    if (adopted) registeredStateOf(adopted)?.signalStore.clear(adopted);
};

const setterValueOf = (node: Node, prop: string): { present: boolean; value: unknown } => {
    for (const child of stateOf(node).children) {
        if (isWrapperKind(child, WIDGET_PROP_KIND) && stateOf(child).props.propName === prop) {
            return { present: true, value: trackedInstance(child) ?? null };
        }
    }
    const value = stateOf(node).props[prop];
    return { present: value !== undefined, value };
};

type CompanionContext = {
    parent: GObject.Object;
    rule: CompanionRule;
    node: Node;
    sync: CompanionSync;
};

const applyCompanionSetters = (context: CompanionContext, content: Gtk.Widget): void => {
    const { parent, rule, node, sync } = context;
    if (rule.setters === undefined) return;
    let applied = sync.appliedSetters.get(content);
    if (applied === undefined) {
        applied = new Map();
        sync.appliedSetters.set(content, applied);
    }
    for (const [prop, method] of Object.entries(rule.setters)) {
        const { present, value } = setterValueOf(node, prop);
        if (present) {
            if (applied.has(prop) && applied.get(prop) === value) continue;
            callMethod(parent, method, [content, value]);
            applied.set(prop, value);
        } else if (applied.has(prop)) {
            callMethod(parent, method, [content, null]);
            applied.delete(prop);
        }
    }
};

const applyCompanionProps = (companion: GObject.Object, built: Props, previous: Props | null): void => {
    applyProps(companion, previous ?? {}, built, {});
};

const companionOrdinal = (parent: Node, node: Node): number => {
    const element = stateOf(node).props.element;
    let ordinal = 0;
    for (const sibling of stateOf(parent).children) {
        if (sibling === node) return ordinal;
        if (isWrapperKind(sibling, COMPANION_KIND) && stateOf(sibling).props.element === element) ordinal++;
    }
    return ordinal;
};

const detachCompanionContent = (context: CompanionContext, content: Gtk.Widget): void => {
    const { parent, rule, sync } = context;
    const companion = sync.companions.get(content);
    sync.companions.delete(content);
    sync.appliedSetters.delete(content);
    if (companion) registeredStateOf(companion)?.signalStore.clear(companion);
    if (rule.remove !== undefined) {
        const stillInside =
            !(parent instanceof Gtk.Widget) || (content.getParent() !== null && isDescendantOf(content, parent));
        if (stillInside) runCall(parent, rule.remove, [content], { child: content });
        return;
    }
    detachChild(content, parent);
};

const attachCompanionContent = (context: CompanionContext, content: Gtk.Widget, ordinal: number | null): unknown => {
    const { parent, rule, node } = context;
    if (rule.insert !== undefined && ordinal !== null) {
        return runCallValue(parent, rule.insert, [content, ordinal], {
            child: content,
            index: ordinal,
            props: stateOf(node).props,
        }).value;
    }
    if (rule.add !== undefined) {
        return runCallValue(parent, rule.add, [content], { child: content, props: stateOf(node).props }).value;
    }
    attachChild(content, parent);
    return undefined;
};

const syncCompanionContent = (context: CompanionContext, content: Gtk.Widget, built: Props): void => {
    const { parent, rule, sync } = context;
    const alreadyHeld = parent instanceof Gtk.Widget && content.getParent() === parent;
    const known = sync.companions.has(content);
    const addResult = alreadyHeld || known ? undefined : attachCompanionContent(context, content, null);
    let companion = sync.companions.get(content);
    if (companion === undefined) {
        companion = acquireCompanion(parent, rule, content, addResult);
        if (companion) sync.companions.set(content, companion);
    }
    if (companion) applyCompanionProps(companion, built, known ? sync.appliedProps : null);
    applyCompanionSetters(context, content);
};

const syncCompanionMulti = (context: CompanionContext): void => {
    const { node, sync } = context;
    const built = companionPropsOf(context.rule, stateOf(node).props);
    const desired = wrapperChildWidgets(node);
    for (const previous of sync.contents) {
        if (!desired.includes(previous)) detachCompanionContent(context, previous);
    }
    for (const content of desired) syncCompanionContent(context, content, built);
    sync.contents = desired;
    sync.appliedProps = built;
    companionState.set(node, sync);
};

const syncCompanionSingle = (context: CompanionContext): void => {
    const { parent, rule, node, sync } = context;
    const built = companionPropsOf(rule, stateOf(node).props);
    const content = trackedWidget(node);
    const previous = sync.contents[0];
    if (previous !== undefined && previous !== content) {
        detachCompanionContent(context, previous);
        releaseAdopted(node);
        sync.contents = [];
    }
    if (content === null) {
        sync.appliedProps = built;
        companionState.set(node, sync);
        return;
    }
    if (sync.contents[0] === content) {
        const companion = sync.companions.get(content);
        if (companion) applyCompanionProps(companion, built, sync.appliedProps);
        applyCompanionSetters(context, content);
        sync.appliedProps = built;
        companionState.set(node, sync);
        return;
    }
    const ordinal = rule.insert !== undefined ? companionOrdinal(parent, node) : null;
    const addResult = attachCompanionContent(context, content, ordinal);
    const companion = acquireCompanion(parent, rule, content, addResult);
    if (companion) {
        adoptCompanion(node, companion);
        sync.companions.set(content, companion);
        applyCompanionProps(companion, built, null);
    }
    applyCompanionSetters(context, content);
    sync.contents = [content];
    sync.appliedProps = built;
    companionState.set(node, sync);
};

export const companionMapping: ElementMapping = {
    matches: (child, parent) =>
        isWrapperKind(child, COMPANION_KIND) && parent instanceof GObject.Object && companionRuleOf(child) !== null,
    attach: (child, parent) => {
        if (!(parent instanceof GObject.Object)) return;
        const rule = companionRuleOf(child);
        if (rule === null) return;
        const sync = companionState.get(child) ?? freshCompanionSync();
        const context: CompanionContext = { parent, rule, node: child, sync };
        if (rule.multi === true) syncCompanionMulti(context);
        else syncCompanionSingle(context);
    },
    detach: (child, parent) => {
        const sync = companionState.get(child);
        companionState.delete(child);
        releaseAdopted(child);
        if (!sync || !(parent instanceof GObject.Object)) return;
        const rule = companionRuleOf(child);
        if (rule === null) return;
        const context: CompanionContext = { parent, rule, node: child, sync };
        for (const content of sync.contents) detachCompanionContent(context, content);
    },
};
