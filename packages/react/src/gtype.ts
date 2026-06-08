import type { GType } from "@gtkx/gi/gobject";
import { typeName, typeParent } from "@gtkx/gi/gobject";
import { CONSTRUCT_ONLY_PROPS, DEFAULT_PROPS, SIGNALS } from "@gtkx/react-jsx/internal";
import { toKebabCase } from "@gtkx/utils";
import type { BackingInstance } from "./types.js";

const NOTIFY_PREFIX = "onNotify";

/**
 * Maps an `onNotify<Prop>` handler prop to the GObject `notify::<prop>` signal
 * it observes, or `null` when the prop is not an `onNotify` handler. The bare
 * `onNotify` prop maps to the undetailed `notify` signal.
 *
 * @param propName - The JSX prop name (e.g. `onNotifyActive`).
 */
export const resolveNotifySignal = (propName: string): string | null => {
    if (propName === NOTIFY_PREFIX) return "notify";
    if (!propName.startsWith(NOTIFY_PREFIX) || propName.length === NOTIFY_PREFIX.length) return null;
    const tail = propName.slice(NOTIFY_PREFIX.length);
    if (tail[0] !== tail[0]?.toUpperCase()) return null;
    return `notify::${toKebabCase(tail.charAt(0).toLowerCase() + tail.slice(1))}`;
};

const typeNameChainCache = new Map<GType, readonly string[]>();
const signalCache = new Map<GType, Map<string, string | null>>();
const constructOnlyCache = new Map<GType, Map<string, boolean>>();
const defaultPropCache = new Map<GType, Map<string, DefaultPropLookup>>();

/**
 * Returns a GLib type's ancestry as type names, most-derived first.
 *
 * Walks the type-parent chain from `gtype` up to the root, collecting each
 * {@link typeName}. The result is cached per GType.
 *
 * @param gtype - the GLib type whose ancestry to collect
 */
export const collectTypeNameChain = (gtype: GType): readonly string[] => {
    const cached = typeNameChainCache.get(gtype);
    if (cached) return cached;

    const chain: string[] = [];
    let current = gtype;
    while (current !== 0) {
        const name = typeName(current);
        if (!name) break;
        chain.push(name);
        current = typeParent(current);
    }

    typeNameChainCache.set(gtype, chain);
    return chain;
};

const memoize = <T>(
    cache: Map<GType, Map<string, T>>,
    instance: BackingInstance,
    key: string,
    compute: (typeNames: readonly string[]) => T,
): T => {
    const gtype = instance.__gtype__;
    let perGType = cache.get(gtype);
    if (!perGType) {
        perGType = new Map();
        cache.set(gtype, perGType);
    }
    const cached = perGType.get(key);
    if (cached !== undefined) return cached;
    const result = compute(collectTypeNameChain(gtype));
    perGType.set(key, result);
    return result;
};

export const isConstructOnlyProp = (instance: BackingInstance, key: string): boolean =>
    memoize(constructOnlyCache, instance, key, (typeNames) => {
        for (const name of typeNames) {
            if (CONSTRUCT_ONLY_PROPS[name]?.has(key)) return true;
        }
        return false;
    });

export const resolveSignal = (instance: BackingInstance, propName: string): string | null => {
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

/**
 * The outcome of a default-prop lookup: whether the property has a known
 * default and, if so, the value to reset it to. A discriminant is needed
 * because a valid default may itself be `null`, `false`, `0`, or `""`.
 */
export type DefaultPropLookup = { readonly has: boolean; readonly value: unknown };

const NO_DEFAULT_PROP: DefaultPropLookup = { has: false, value: undefined };

/**
 * Resolves the value a removed prop should be reset to: the property's GIR
 * default, looked up by walking the instance's GType ancestry against the
 * generated `DEFAULT_PROPS` table. Returns {@link NO_DEFAULT_PROP} when no
 * default is known, in which case the prop is left untouched.
 *
 * @param instance - the backing GObject whose property is being reset
 * @param key - the camelCase property name
 */
export const resolveDefaultProp = (instance: BackingInstance, key: string): DefaultPropLookup =>
    memoize(defaultPropCache, instance, key, (typeNames) => {
        for (const name of typeNames) {
            const table = DEFAULT_PROPS[name];
            if (table && key in table) return { has: true, value: table[key] };
        }
        return NO_DEFAULT_PROP;
    });
