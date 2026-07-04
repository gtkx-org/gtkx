import type { AttachRule, Call } from "@gtkx/config";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { callMethod } from "@gtkx/utils";
import { collectTypeNameChain } from "../utils/gtype.js";
import type { ElementMapping } from "./dispatch.js";
import { type CallScope, resolveAttachRule, runCall } from "./rule-table.js";
import { type Node, stateOf } from "./state.js";

const attachedParent = new WeakMap<GObject.Object, GObject.Object>();

const scopeFor = (child: GObject.Object, extra?: Partial<CallScope>): CallScope => ({
    child,
    props: stateOf(child).props,
    ...extra,
});

const nullSetterCurrentHolder = (parent: GObject.Object, call: Call): unknown => {
    if (typeof call === "string" || !call.method.startsWith("set")) return undefined;
    if (!call.args.some((arg) => typeof arg === "object" && "literal" in arg && arg.literal === null)) {
        return undefined;
    }
    const getter = `get${call.method.slice(3)}`;
    if (typeof Reflect.get(parent, getter) !== "function") return undefined;
    return callMethod(parent, getter, []);
};

const runRemove = (parent: GObject.Object, child: GObject.Object, rule: AttachRule): void => {
    if (rule.remove === undefined) return;
    const holder = nullSetterCurrentHolder(parent, rule.remove);
    if (holder !== undefined && holder !== child) return;
    runCall(parent, rule.remove, [child], scopeFor(child));
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
    runRemove(parent, child, rule);
    attachedParent.delete(child);
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
