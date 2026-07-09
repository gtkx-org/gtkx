/// <reference types="@gtkx/config/env" />

import { ELEMENT_PROPS } from "virtual:gtkx-config";
import type { AppliedProp, Arg, ArgRef, Call, ContainerProp } from "@gtkx/config";
import { typeFromName } from "@gtkx/gi/gobject";
import { callMethod } from "@gtkx/utils";
import { collectTypeNamesWithInterfaces, foldInheritedTableWithInterfaces } from "../utils/gtype.js";

export type CallScope = {
    child?: unknown;
    item?: unknown;
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
            case "index":
                return scope.index;
            case "sibling":
                return scope.sibling;
        }
    }
    if ("literal" in arg) return arg.literal;
    if ("prop" in arg) {
        const value = scope.props?.[arg.prop];
        return value == null ? MISSING_ARG : value;
    }
    const value = fieldOf(scope.item, arg.field);
    if (value == null && "or" in arg) return arg.or;
    return value;
};

type CallResult = {
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

const attachIndex = new Map<string, ContainerProp>();
const adoptByParent = new Map<string, ContainerProp>();
const namedContainerPropsByParent: Record<string, string[]> = {};
const APPLIED_BY_TYPE: Record<string, AppliedProp[]> = {};

for (const [parent, props] of Object.entries(ELEMENT_PROPS)) {
    for (const prop of props) {
        if (prop.kind === "container") {
            attachIndex.set(`${parent}:${prop.child}:${prop.prop === "children" ? "" : prop.prop}`, prop);
            if (prop.prop !== "children") {
                const propNames = namedContainerPropsByParent[parent] ?? [];
                propNames.push(prop.prop);
                namedContainerPropsByParent[parent] = propNames;
            }
            if (prop.adopt !== undefined) adoptByParent.set(parent, prop);
        } else {
            const applied = APPLIED_BY_TYPE[parent] ?? [];
            applied.push(prop);
            APPLIED_BY_TYPE[parent] = applied;
        }
    }
}

const attachCache = new Map<string, ContainerProp | null>();

export const resolveContainerProp = (
    parentType: bigint,
    childType: bigint,
    propName: string | undefined,
): ContainerProp | null => {
    const cacheKey = `${parentType}:${childType}:${propName ?? ""}`;
    const cached = attachCache.get(cacheKey);
    if (cached !== undefined) return cached;
    let resolved: ContainerProp | null = null;
    const parentNames = collectTypeNamesWithInterfaces(parentType);
    for (const childName of collectTypeNamesWithInterfaces(childType)) {
        for (const parentName of parentNames) {
            resolved = attachIndex.get(`${parentName}:${childName}:${propName ?? ""}`) ?? null;
            if (resolved !== null) break;
        }
        if (resolved !== null) break;
    }
    attachCache.set(cacheKey, resolved);
    return resolved;
};

const adoptCache = new Map<bigint, ContainerProp | null>();

export const adoptContainerPropFor = (parentType: bigint): ContainerProp | null => {
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

const containerPropNamesCache = new Map<string, Set<string>>();

export const containerPropNamesFor = (elementName: string): Set<string> => {
    const cached = containerPropNamesCache.get(elementName);
    if (cached) return cached;
    const names = foldInheritedTableWithInterfaces(
        typeFromName(elementName),
        namedContainerPropsByParent,
        (collected: Set<string>, propNames) => {
            for (const name of propNames) collected.add(name);
            return collected;
        },
        new Set<string>(),
    );
    containerPropNamesCache.set(elementName, names);
    return names;
};

const appliedCache = new Map<bigint, Map<string, AppliedProp>>();

export const appliedPropsFor = (gtype: bigint): Map<string, AppliedProp> => {
    const cached = appliedCache.get(gtype);
    if (cached) return cached;
    const resolved = foldInheritedTableWithInterfaces<AppliedProp[], Map<string, AppliedProp>>(
        gtype,
        APPLIED_BY_TYPE,
        (collected, props) => {
            for (const prop of props) {
                if (!collected.has(prop.prop)) collected.set(prop.prop, prop);
            }
            return collected;
        },
        new Map(),
    );
    appliedCache.set(gtype, resolved);
    return resolved;
};

export const isAppliedProp = (gtype: bigint, name: string): boolean => appliedPropsFor(gtype).has(name);

const constructionSkipCache = new Map<bigint, Set<string>>();

export const constructionSkipProps = (gtype: bigint): Set<string> => {
    const cached = constructionSkipCache.get(gtype);
    if (cached) return cached;
    const skipped = new Set<string>();
    for (const prop of appliedPropsFor(gtype).values()) {
        if (prop.kind === "lazy") skipped.add(prop.prop);
    }
    constructionSkipCache.set(gtype, skipped);
    return skipped;
};
