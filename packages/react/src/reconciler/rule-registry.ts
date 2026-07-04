import type { RuleContext, RuleNode, RuleSet } from "@gtkx/config";
import type { TypedClass } from "@gtkx/ffi";
import * as GObject from "@gtkx/gi/gobject";
import { foldInheritedTableWithInterfaces } from "../utils/gtype.js";
import { BUILT_IN_RULES } from "./rules.js";
import { type Node, stateOf } from "./state.js";

const RULE_REGISTRY = BUILT_IN_RULES;

export const RULE_CONTEXT: RuleContext = {
    instanceIsA: (instance, typeName) =>
        GObject.typeIsA((instance as TypedClass).__type__, GObject.typeFromName(typeName)),
};

const appendRuleSetCache = new Map<GObject.Type, RuleSet | null>();

export const resolveAppendRuleSet = (gtype: GObject.Type): RuleSet | null => {
    const cached = appendRuleSetCache.get(gtype);
    if (cached !== undefined) return cached;
    const resolved = foldInheritedTableWithInterfaces<RuleSet, RuleSet | null>(
        gtype,
        RULE_REGISTRY,
        (accumulator, row) => accumulator ?? (row.appendChild !== undefined ? row : null),
        null,
    );
    appendRuleSetCache.set(gtype, resolved);
    return resolved;
};

export const ruleNodeOf = (node: Node, slotTag?: string): RuleNode | null =>
    node instanceof GObject.Object ? { instance: node, props: stateOf(node).props, slotTag } : null;

export const namedRuleSet = (name: string): RuleSet | undefined => RULE_REGISTRY[name];
