/// <reference types="@gtkx/config/env" />
import {
    CONSTRUCT_ONLY_PROPS,
    CONSTRUCT_PROPS,
    DEFAULT_PROPS,
    elements,
    SIGNALS,
    userEventSignals,
} from "virtual:gtkx-config";
import { getSignalBaseName, TYPE_INVALID, typeFromName, typeInterfaces, typeName, typeParent } from "@gtkx/runtime";
import { deferredProps, ELEMENTS, type ElementBehavior, GTK_ELEMENTS, registerElements } from "./behaviors.js";

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

registerElements(elements, GTK_ELEMENTS);

const ancestryCache = new Map<string, string[]>();
const typeInfoCache = new Map<string, TypeInfo>();

const addAncestor = (names: string[], seen: Set<string>, name: string | null): void => {
    if (name !== null && !seen.has(name)) {
        seen.add(name);
        names.push(name);
    }
};

const ancestryOf = (name: string): string[] => {
    const cached = ancestryCache.get(name);
    if (cached !== undefined) return cached;
    const names: string[] = [];
    const seen = new Set<string>();
    let type = typeFromName(name);
    while (type !== TYPE_INVALID) {
        addAncestor(names, seen, typeName(type));
        for (const iface of typeInterfaces(type)) addAncestor(names, seen, typeName(iface));
        type = typeParent(type);
    }
    ancestryCache.set(name, names);
    return names;
};

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

export const typeInfoOf = (name: string): TypeInfo => {
    const cached = typeInfoCache.get(name);
    if (cached !== undefined) return cached;
    const info = buildTypeInfo(name);
    typeInfoCache.set(name, info);
    return info;
};

export const isBlockableSignal = (info: TypeInfo, signal: string): boolean =>
    info.userEventSignals.has(getSignalBaseName(signal));
