import { CONSTRUCT_ONLY_PROPS, CONSTRUCT_PROPS, DEFAULT_PROPS, SIGNALS } from "virtual:gtkx-config";
import type { TypedClass } from "@gtkx/runtime";
import { getOrInsert, upperFirst } from "@gtkx/utils";
import { NOTIFY_SIGNAL, propToNotifySignal } from "./notify-name.js";
import { collectTypeNameChain, foldInheritedTable } from "./type-hierarchy.js";

const NOTIFY_PREFIX = "onNotify";

const resolveNotifySignal = (propName: string): string | null => {
    if (propName === NOTIFY_PREFIX) return NOTIFY_SIGNAL;
    if (!propName.startsWith(NOTIFY_PREFIX)) return null;
    const tail = propName.slice(NOTIFY_PREFIX.length);
    if (upperFirst(tail) !== tail) return null;
    return propToNotifySignal(tail);
};

const signalCache = new Map<bigint, Map<string, string | null>>();
const constructOnlyCache = new Map<bigint, Map<string, boolean>>();
const defaultPropCache = new Map<bigint, Map<string, DefaultPropLookup>>();
const constructablePropsCache = new Map<bigint, Set<string>>();

const memoize = <T>(
    cache: Map<bigint, Map<string, T>>,
    instance: TypedClass,
    key: string,
    compute: (typeNames: string[]) => T,
): T => {
    const gtype = instance.__type__;
    const perGtype = getOrInsert(cache, gtype, () => new Map<string, T>());
    return getOrInsert(perGtype, key, () => compute(collectTypeNameChain(gtype)));
};

export const collectConstructableProps = (gtype: bigint): Set<string> =>
    getOrInsert(constructablePropsCache, gtype, () =>
        foldInheritedTable(
            gtype,
            CONSTRUCT_PROPS,
            (collected: Set<string>, props) => {
                for (const prop of props) collected.add(prop);
                return collected;
            },
            new Set<string>(),
        ),
    );

export const isConstructOnlyProp = (instance: TypedClass, key: string): boolean =>
    memoize(constructOnlyCache, instance, key, (typeNames) => {
        for (const name of typeNames) {
            if (CONSTRUCT_ONLY_PROPS[name]?.has(key)) return true;
        }
        return false;
    });

export const resolveSignal = (instance: TypedClass, propName: string): string | null => {
    const notify = resolveNotifySignal(propName);
    if (notify) return notify;
    return memoize(signalCache, instance, propName, (typeNames) => {
        for (const name of typeNames) {
            const result = SIGNALS[name]?.[propName];
            if (result) return result;
        }
        return null;
    });
};

type DefaultPropLookup = { has: boolean; value: unknown };

const NO_DEFAULT_PROP: DefaultPropLookup = { has: false, value: undefined };

export const resolveDefaultProp = (instance: TypedClass, key: string): DefaultPropLookup =>
    memoize(defaultPropCache, instance, key, (typeNames) => {
        for (const name of typeNames) {
            const table = DEFAULT_PROPS[name];
            if (table && key in table) return { has: true, value: table[key] };
        }
        return NO_DEFAULT_PROP;
    });
