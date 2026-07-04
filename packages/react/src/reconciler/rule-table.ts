/// <reference types="@gtkx/config/env" />

import { SYNTHETIC_PROPS } from "virtual:gtkx-config";
import type { Arg, Call, SyntheticPropRule } from "@gtkx/config";
import { callMethod } from "@gtkx/utils";
import { foldInheritedTableWithInterfaces } from "../utils/gtype.js";

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

export const runCall = (target: object, call: Call, defaults: unknown[], scope: CallScope): boolean => {
    if (typeof call === "string") {
        callMethod(target, call, defaults);
        return true;
    }
    const args = call.args.map((arg) => evalArg(arg, scope));
    if (args.includes(MISSING_ARG)) return false;
    callMethod(target, call.method, args);
    return true;
};

export const writeTarget = (instance: object, name: string, value: unknown): void => {
    if (typeof Reflect.get(instance, name) === "function") callMethod(instance, name, [value]);
    else Reflect.set(instance, name, value);
};

const SYNTHETIC_BY_TYPE: Record<string, SyntheticPropRule[]> = {};
for (const rule of SYNTHETIC_PROPS) {
    (SYNTHETIC_BY_TYPE[rule.type] ??= []).push(rule);
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
