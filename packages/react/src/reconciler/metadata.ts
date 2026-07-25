import { CONSTRUCT_ONLY_PROPS, CONSTRUCT_PROPS, DEFAULT_PROPS, SIGNALS, userEventSignals } from "virtual:gtkx-config";
import { getSignalBaseName, TYPE_INVALID, typeFromName, typeInterfaces, typeName, typeParent } from "@gtkx/runtime";
import { getOrInsert } from "@gtkx/utils";
import { deferredProps, ELEMENTS, type ElementBehavior } from "./registry.js";

export type TypeInfo = {
    typeName: string;
    signals: Record<string, string>;
    userEventSignals: Set<string>;
    behaviors: ElementBehavior[];
    deferred: Set<string>;
    lazy: boolean;
    hasFlush: boolean;
    hasMount: boolean;
    constructOnly: Set<string>;
    construct: Set<string>;
    defaults: Record<string, unknown>;
};

const ancestryCache = new Map<string, string[]>();
const typeInfoCache = new Map<string, TypeInfo>();

const addAncestor = (names: string[], seen: Set<string>, name: string | null): void => {
    if (name !== null && !seen.has(name)) {
        seen.add(name);
        names.push(name);
    }
};

const buildAncestry = (name: string): string[] => {
    const names: string[] = [];
    const seen = new Set<string>();
    let type = typeFromName(name);
    while (type !== TYPE_INVALID) {
        addAncestor(names, seen, typeName(type));
        for (const iface of typeInterfaces(type)) addAncestor(names, seen, typeName(iface));
        type = typeParent(type);
    }
    return names;
};

const ancestryOf = (name: string): string[] => getOrInsert(ancestryCache, name, buildAncestry);

const accumulateAncestor = (info: TypeInfo, ancestor: string): void => {
    Object.assign(info.signals, SIGNALS[ancestor] ?? {});
    for (const signal of userEventSignals[ancestor] ?? []) info.userEventSignals.add(signal);
    for (const prop of CONSTRUCT_ONLY_PROPS[ancestor] ?? []) info.constructOnly.add(prop);
    for (const prop of CONSTRUCT_PROPS[ancestor] ?? []) info.construct.add(prop);
    info.behaviors.push(...(ELEMENTS[ancestor]?.behaviors ?? []));
};

const resolveBehaviorFlags = (info: TypeInfo): void => {
    for (const behavior of info.behaviors) {
        if (behavior.flush !== undefined) info.hasFlush = true;
        if (behavior.mount !== undefined) info.hasMount = true;
        for (const prop of deferredProps(behavior)) info.deferred.add(prop);
    }
};

const buildTypeInfo = (name: string): TypeInfo => {
    const chain = ancestryOf(name);
    const info: TypeInfo = {
        typeName: name,
        signals: {},
        userEventSignals: new Set(),
        behaviors: [],
        deferred: new Set(),
        lazy: false,
        hasFlush: false,
        hasMount: false,
        constructOnly: new Set(),
        construct: new Set(),
        defaults: {},
    };
    for (const ancestor of chain) accumulateAncestor(info, ancestor);
    resolveBehaviorFlags(info);
    info.lazy = chain.some((ancestor) => ELEMENTS[ancestor]?.lazy === true);
    for (const ancestor of [...chain].reverse()) Object.assign(info.defaults, DEFAULT_PROPS[ancestor] ?? {});
    return info;
};

export const typeInfoOf = (name: string): TypeInfo => getOrInsert(typeInfoCache, name, buildTypeInfo);

export const isBlockableSignal = (info: TypeInfo, signal: string): boolean =>
    info.userEventSignals.has(getSignalBaseName(signal));
