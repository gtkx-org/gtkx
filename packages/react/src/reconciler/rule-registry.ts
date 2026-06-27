/// <reference types="@gtkx/config/env" />

import { RULE_REGISTRY } from "virtual:gtkx-config";
import type { RuleNode, RuleSet } from "@gtkx/config";
import * as GObject from "@gtkx/gi/gobject";
import { foldInheritedTableWithInterfaces } from "../utils/gtype.js";
import { type Node, stateOf } from "./state.js";

type RuleCapability = "appendChild" | "setProps";

const capabilityCaches = new Map<RuleCapability, Map<GObject.Type, RuleSet | null>>();

const cacheFor = (capability: RuleCapability): Map<GObject.Type, RuleSet | null> => {
    const cached = capabilityCaches.get(capability);
    if (cached) return cached;
    const created = new Map<GObject.Type, RuleSet | null>();
    capabilityCaches.set(capability, created);
    return created;
};

const resolveRuleSetWith = (gtype: GObject.Type, capability: RuleCapability): RuleSet | null => {
    const cache = cacheFor(capability);
    const cached = cache.get(gtype);
    if (cached !== undefined) return cached;
    const resolved = foldInheritedTableWithInterfaces<RuleSet, RuleSet | null>(
        gtype,
        RULE_REGISTRY,
        (accumulator, row) => accumulator ?? (row[capability] !== undefined ? row : null),
        null,
    );
    cache.set(gtype, resolved);
    return resolved;
};

export const resolveAppendRuleSet = (gtype: GObject.Type): RuleSet | null => resolveRuleSetWith(gtype, "appendChild");

export const resolveSetPropsRuleSet = (gtype: GObject.Type): RuleSet | null => resolveRuleSetWith(gtype, "setProps");

export const ruleNodeOf = (node: Node, slotTag?: string): RuleNode | null =>
    node instanceof GObject.Object ? { instance: node, props: stateOf(node).props, slotTag } : null;

export const namedRuleSet = (name: string): RuleSet | undefined => RULE_REGISTRY[name];

const RULE_MANAGED_PROPS: Record<string, string[]> = {
    GtkEditable: ["text"],
    GtkStack: ["visibleChildName"],
    AdwViewStack: ["visibleChildName"],
    AdwToggleGroup: ["activeName", "active"],
    GtkTextTag: ["priority", "foreground", "background", "paragraphBackground"],
};

const ruleManagedCache = new Map<GObject.Type, Set<string>>();

const ruleManagedProps = (gtype: GObject.Type): Set<string> => {
    const cached = ruleManagedCache.get(gtype);
    if (cached) return cached;
    const names = foldInheritedTableWithInterfaces<string[], Set<string>>(
        gtype,
        RULE_MANAGED_PROPS,
        (collected, propNames) => {
            for (const name of propNames) collected.add(name);
            return collected;
        },
        new Set<string>(),
    );
    ruleManagedCache.set(gtype, names);
    return names;
};

export const isRuleManagedProp = (instance: GObject.Object, name: string): boolean =>
    ruleManagedProps(instance.__gtype__).has(name);
