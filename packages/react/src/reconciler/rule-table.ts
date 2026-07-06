/// <reference types="@gtkx/config/env" />

import { CONTAINER_PROPS, SYNTHETIC_PROPS } from "virtual:gtkx-config";
import type { Arg, ArgRef, Call, ContainerProp, SyntheticPropRule } from "@gtkx/config";
import { typeFromName } from "@gtkx/gi/gobject";
import { callMethod } from "@gtkx/utils";
import { collectTypeNamesWithInterfaces, foldInheritedTableWithInterfaces } from "../utils/gtype.js";

export type CallScope = {
    child?: unknown;
    item?: unknown;
    value?: unknown;
    index?: number;
    sibling?: unknown;
    props?: Record<string, unknown>;
};

const MISSING_ARG = Symbol("gtkx.missing-arg");

const fieldOf = (source: unknown, name: string): unknown =>
    source == null ? undefined : Reflect.get(Object(source), name);

const evalArg = (arg: Arg, scope: CallScope): unknown => {
    if (typeof arg === "string") {
        switch (arg) {
            case "child":
                return scope.child;
            case "item":
                return scope.item;
            case "value":
                return scope.value;
            case "index":
                return scope.index;
            case "sibling":
                return scope.sibling;
        }
    }
    if ("literal" in arg) return arg.literal;
    if ("prop" in arg) {
        const value = scope.props?.[arg.prop];
        if (value == null) return "or" in arg ? arg.or : MISSING_ARG;
        return value;
    }
    const value = fieldOf(scope.item, arg.field);
    if (value == null && "or" in arg) return arg.or;
    return value;
};

export type CallResult = {
    called: boolean;
    value: unknown;
};

export const runCallValue = (target: object, call: Call, defaults: unknown[], scope: CallScope): CallResult => {
    if (typeof call === "string") {
        return { called: true, value: callMethod(target, call, defaults) };
    }
    const args = call.args.map((arg) => evalArg(arg, scope));
    if (args.includes(MISSING_ARG)) return { called: false, value: undefined };
    return { called: true, value: callMethod(target, call.method, args) };
};

export const runCall = (target: object, call: Call, defaults: unknown[], scope: CallScope): boolean =>
    runCallValue(target, call, defaults, scope).called;

export const callUsesRef = (call: Call | undefined, ref: ArgRef): boolean =>
    call !== undefined && typeof call !== "string" && call.args.some((arg) => arg === ref);

export const nullSetterCurrentHolder = (target: object, call: Call): unknown => {
    if (typeof call === "string" || !call.method.startsWith("set")) return undefined;
    if (!call.args.some((arg) => typeof arg === "object" && "literal" in arg && arg.literal === null)) {
        return undefined;
    }
    const getter = `get${call.method.slice(3)}`;
    if (typeof Reflect.get(target, getter) !== "function") return undefined;
    return callMethod(target, getter, []);
};

export const writeTarget = (instance: object, name: string, value: unknown): void => {
    if (typeof Reflect.get(instance, name) === "function") callMethod(instance, name, [value]);
    else Reflect.set(instance, name, value);
};

const attachIndex = new Map<string, ContainerProp>();
const adoptByParent = new Map<string, ContainerProp>();
const slotsByParent: Record<string, string[]> = {};

for (const [parent, props] of Object.entries(CONTAINER_PROPS)) {
    for (const cp of props) {
        attachIndex.set(`${parent}:${cp.child}:${cp.prop === "children" ? "" : cp.prop}`, cp);
        if (cp.prop !== "children") {
            const slots = slotsByParent[parent] ?? [];
            slots.push(cp.prop);
            slotsByParent[parent] = slots;
        }
        if (cp.adopt !== undefined) adoptByParent.set(parent, cp);
    }
}

const attachCache = new Map<string, ContainerProp | null>();

export const resolveAttachRule = (
    parentType: bigint,
    childType: bigint,
    slot: string | undefined,
): ContainerProp | null => {
    const cacheKey = `${parentType}:${childType}:${slot ?? ""}`;
    const cached = attachCache.get(cacheKey);
    if (cached !== undefined) return cached;
    let resolved: ContainerProp | null = null;
    const parentNames = collectTypeNamesWithInterfaces(parentType);
    for (const childName of collectTypeNamesWithInterfaces(childType)) {
        for (const parentName of parentNames) {
            resolved = attachIndex.get(`${parentName}:${childName}:${slot ?? ""}`) ?? null;
            if (resolved !== null) break;
        }
        if (resolved !== null) break;
    }
    attachCache.set(cacheKey, resolved);
    return resolved;
};

const adoptCache = new Map<bigint, ContainerProp | null>();

export const adoptRuleFor = (parentType: bigint): ContainerProp | null => {
    const cached = adoptCache.get(parentType);
    if (cached !== undefined) return cached;
    let resolved: ContainerProp | null = null;
    for (const name of collectTypeNamesWithInterfaces(parentType)) {
        const cp = adoptByParent.get(name);
        if (cp !== undefined) {
            resolved = cp;
            break;
        }
    }
    adoptCache.set(parentType, resolved);
    return resolved;
};

const slotPropsCache = new Map<string, Set<string>>();

export const slotPropsFor = (elementName: string): Set<string> => {
    const cached = slotPropsCache.get(elementName);
    if (cached) return cached;
    const names = foldInheritedTableWithInterfaces(
        typeFromName(elementName),
        slotsByParent,
        (collected: Set<string>, slotNames) => {
            for (const name of slotNames) collected.add(name);
            return collected;
        },
        new Set<string>(),
    );
    slotPropsCache.set(elementName, names);
    return names;
};

const SYNTHETIC_BY_TYPE: Record<string, SyntheticPropRule[]> = {};
for (const rule of SYNTHETIC_PROPS) {
    const rules = SYNTHETIC_BY_TYPE[rule.type] ?? [];
    rules.push(rule);
    SYNTHETIC_BY_TYPE[rule.type] = rules;
}

const syntheticRulesCache = new Map<bigint, Map<string, SyntheticPropRule>>();

export const syntheticRulesFor = (gtype: bigint): Map<string, SyntheticPropRule> => {
    const cached = syntheticRulesCache.get(gtype);
    if (cached) return cached;
    const resolved = foldInheritedTableWithInterfaces<SyntheticPropRule[], Map<string, SyntheticPropRule>>(
        gtype,
        SYNTHETIC_BY_TYPE,
        (collected, rules) => {
            for (const rule of rules) {
                if (!collected.has(rule.prop)) collected.set(rule.prop, rule);
            }
            return collected;
        },
        new Map(),
    );
    syntheticRulesCache.set(gtype, resolved);
    return resolved;
};

export const isSyntheticProp = (gtype: bigint, name: string): boolean => syntheticRulesFor(gtype).has(name);

const constructionSkipCache = new Map<bigint, Set<string>>();

export const constructionSkipProps = (gtype: bigint): Set<string> => {
    const cached = constructionSkipCache.get(gtype);
    if (cached) return cached;
    const skipped = new Set<string>();
    for (const rule of syntheticRulesFor(gtype).values()) {
        if (rule.kind === "selection") skipped.add(rule.prop);
    }
    constructionSkipCache.set(gtype, skipped);
    return skipped;
};
