import { TYPE_INVALID, typeFromName, typeInterfaces, typeName, typeParent } from "@gtkx/runtime";
import { getOrInsert } from "@gtkx/utils";
import { CONSTRUCT_ONLY_PROPS, CONSTRUCT_PROPS, DEFAULT_PROPS, SIGNALS, userEventSignals } from "virtual:gtkx-config";
import { deferredProps, type ElementBehavior, ELEMENTS } from "./registry.js";

type TypeInfo = {
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

const ancestryCache: Map<string, string[]> = new Map();
const typeInfoCache: Map<string, TypeInfo> = new Map();

const addAncestor = (names: string[], seen: Set<string>, name: string | null): void => {
    if (name === null || seen.has(name)) {
        return;
    }

    seen.add(name);
    names.push(name);
};

const buildAncestry = (name: string): string[] => {
    const names: string[] = [];
    const seen: Set<string> = new Set();
    let type = typeFromName(name);

    while (type !== TYPE_INVALID) {
        addAncestor(names, seen, typeName(type));

        for (const iface of typeInterfaces(type)) {
            addAncestor(names, seen, typeName(iface));
        }

        type = typeParent(type);
    }

    return names;
};

const ancestryFor = (name: string): string[] => getOrInsert(ancestryCache, name, buildAncestry);

const addAll = <T>(target: Set<T>, source: Iterable<T> | undefined): void => {
    const items = source ?? [];

    for (const item of items) {
        target.add(item);
    }
};

const accumulateAncestor = (info: TypeInfo, ancestor: string): void => {
    Object.assign(info.signals, SIGNALS[ancestor] ?? {});
    addAll(info.userEventSignals, userEventSignals[ancestor]);
    addAll(info.constructOnly, CONSTRUCT_ONLY_PROPS[ancestor]);
    addAll(info.construct, CONSTRUCT_PROPS[ancestor]);
    info.behaviors.push(...(ELEMENTS[ancestor]?.behaviors ?? []));
};

const applyBehaviorFlags = (info: TypeInfo, behavior: ElementBehavior): void => {
    if (behavior.flush !== undefined) {
        info.hasFlush = true;
    }

    if (behavior.mount !== undefined) {
        info.hasMount = true;
    }

    addAll(info.deferred, deferredProps(behavior));
};

const resolveBehaviorFlags = (info: TypeInfo): void => {
    for (const behavior of info.behaviors) {
        applyBehaviorFlags(info, behavior);
    }
};

const buildTypeInfo = (name: string): TypeInfo => {
    const chain = ancestryFor(name);

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

    for (const ancestor of chain) {
        accumulateAncestor(info, ancestor);
    }

    resolveBehaviorFlags(info);
    info.lazy = chain.some((ancestor) => ELEMENTS[ancestor]?.lazy === true);

    for (const ancestor of chain.toReversed()) {
        Object.assign(info.defaults, DEFAULT_PROPS[ancestor] ?? {});
    }

    return info;
};

const typeInfoFor = (name: string): TypeInfo => getOrInsert(typeInfoCache, name, buildTypeInfo);

export { typeInfoFor, type TypeInfo };
