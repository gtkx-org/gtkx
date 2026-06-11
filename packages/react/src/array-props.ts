/// <reference types="@gtkx/config/virtual" />

/**
 * The reconciler's array-prop interpreter.
 *
 * A handful of widget props take an array whose elements map to repeated GTK
 * calls (`addMark`, `addResponse`, `markDay`, …) instead of a single property
 * set. Each is one serializable {@link "@gtkx/config".ArrayPropRow}: the rows
 * arrive merged through `virtual:gtkx-config` — codegen's built-ins overlaid
 * with the project's `gtkx.config.ts` `arrayProps` rows — and this module
 * compiles them into the descriptors `apply-props` reconciles with.
 * `apply-props` walks an instance's GType ancestry, and on array-identity
 * change reconciles the previous elements against the current ones through
 * the matching descriptor.
 *
 * The rows also own the matching JSX surface: codegen types each prop as
 * `prop?: ItemType[] | null;` from the same merged map and suppresses the raw
 * GObject prop of the same name.
 */
import { ARRAY_PROPS as ARRAY_PROP_ROWS } from "virtual:gtkx-config";
import type { ArrayPropRow, CallStep, ConstructStep, PresenceCondition } from "@gtkx/config";
import type { GType } from "@gtkx/gi/gobject";
import { collectTypeNameChain } from "./gtype.js";
import { requireClassByName } from "./gtype-predicates.js";
import { callMethod } from "./nodes/internal/reflect-call.js";
import type { BackingInstance } from "./types.js";

/**
 * Describes how one array-valued prop reconciles its elements into GTK calls.
 * Apply order: `set` replaces the whole list in one call; otherwise old
 * elements are removed (`clear` once, else `remove` each) and new ones added
 * (`add` each). `appendOnce` marks an immutable list applied only when the
 * previous one was empty.
 */
export interface ArrayPropDescriptor {
    /** Removes every previously-applied element in one call. */
    clear?(target: BackingInstance): void;
    /** Removes one previously-applied element. */
    remove?(target: BackingInstance, item: unknown, index: number): void;
    /** Adds one current element. */
    add?(target: BackingInstance, item: unknown, index: number): void;
    /** Replaces the whole list in one call (used when GTK has no per-element API). */
    set?(target: BackingInstance, items: readonly unknown[]): void;
    /** When true, the list is immutable: apply only when the previous list was empty. */
    appendOnce?: boolean;
}

const itemField = (item: unknown, path: string): unknown =>
    typeof item === "object" && item !== null ? Reflect.get(item, path) : undefined;

const satisfies = (value: unknown, condition: PresenceCondition): boolean =>
    condition === "defined" ? value !== undefined : value != null;

const resolveCallArg = (arg: CallStep["args"][number], item: unknown): unknown => {
    if (arg.kind === "value") return arg.value;
    if (arg.path === undefined) return item;
    const value = itemField(item, arg.path);
    return "fallback" in arg ? (value ?? arg.fallback) : value;
};

const runCallStep = (target: BackingInstance, step: CallStep, item: unknown): void => {
    if (step.when && !satisfies(itemField(item, step.when.path), step.when.is)) return;
    callMethod(
        target,
        step.method,
        step.args.map((arg) => resolveCallArg(arg, item)),
    );
};

const runConstructStep = (target: BackingInstance, step: ConstructStep, item: unknown): void => {
    const constructed = new (requireClassByName(step.type) as new () => object)();
    for (const setter of step.setters) {
        const value = itemField(item, setter.path);
        if (satisfies(value, setter.when)) callMethod(constructed, setter.method, [value]);
    }
    callMethod(target, step.attach, [constructed]);
};

const compileRow = (row: ArrayPropRow): ArrayPropDescriptor => {
    const descriptor: ArrayPropDescriptor = {};
    const { clear, remove, add, construct, set } = row;
    if (set !== undefined) descriptor.set = (target, items) => callMethod(target, set, [items]);
    if (row.appendOnce) descriptor.appendOnce = true;
    if (clear !== undefined) descriptor.clear = (target) => callMethod(target, clear, []);
    if (remove !== undefined) descriptor.remove = (target, item) => runCallStep(target, remove, item);
    if (add !== undefined) {
        descriptor.add = (target, item) => {
            for (const step of add) runCallStep(target, step, item);
        };
    }
    if (construct !== undefined) descriptor.add = (target, item) => runConstructStep(target, construct, item);
    return descriptor;
};

const compileRows = (): Readonly<Record<string, Readonly<Record<string, ArrayPropDescriptor>>>> => {
    const compiled: Record<string, Record<string, ArrayPropDescriptor>> = {};
    for (const [typeName, props] of Object.entries(ARRAY_PROP_ROWS)) {
        const entry: Record<string, ArrayPropDescriptor> = {};
        for (const [prop, row] of Object.entries(props)) entry[prop] = compileRow(row);
        compiled[typeName] = entry;
    }
    return compiled;
};

/**
 * The compiled array-prop descriptors keyed by GLib type name, then by prop
 * name, from the merged rows delivered by `virtual:gtkx-config`.
 * `apply-props` merges the entries for every type in an instance's GType
 * ancestry.
 */
export const ARRAY_PROPS: Readonly<Record<string, Readonly<Record<string, ArrayPropDescriptor>>>> = compileRows();

const arrayPropCache = new Map<GType, ReadonlyMap<string, ArrayPropDescriptor>>();

/**
 * Returns the array-prop descriptors for `instance`, merged across its GType
 * ancestry (most-derived first), keyed by prop name. Cached per GType.
 *
 * @param instance - The backing GObject whose array props to resolve.
 */
export const collectArrayProps = (instance: BackingInstance): ReadonlyMap<string, ArrayPropDescriptor> => {
    const cached = arrayPropCache.get(instance.__gtype__);
    if (cached) return cached;
    const merged = new Map<string, ArrayPropDescriptor>();
    for (const typeName of collectTypeNameChain(instance.__gtype__)) {
        const entry = ARRAY_PROPS[typeName];
        if (!entry) continue;
        for (const [prop, descriptor] of Object.entries(entry)) {
            if (!merged.has(prop)) merged.set(prop, descriptor);
        }
    }
    arrayPropCache.set(instance.__gtype__, merged);
    return merged;
};

const toArray = (value: unknown): readonly unknown[] => (Array.isArray(value) ? value : []);

/**
 * Reconciles a single array prop on `target` from its previous value to the new
 * one through `descriptor`.
 *
 * @param target - The backing GObject the prop applies to.
 * @param descriptor - The array-prop descriptor.
 * @param oldValue - The previously-committed array value.
 * @param newValue - The array value to apply.
 */
export const applyArrayProp = (
    target: BackingInstance,
    descriptor: ArrayPropDescriptor,
    oldValue: unknown,
    newValue: unknown,
): void => {
    const oldItems = toArray(oldValue);
    const newItems = toArray(newValue);
    if (descriptor.set) {
        descriptor.set(target, newItems);
        return;
    }
    if (descriptor.appendOnce) {
        if (oldItems.length === 0) addAll(target, descriptor, newItems);
        return;
    }
    if (descriptor.clear) descriptor.clear(target);
    else removeAll(target, descriptor, oldItems);
    addAll(target, descriptor, newItems);
};

const addAll = (target: BackingInstance, descriptor: ArrayPropDescriptor, items: readonly unknown[]): void => {
    items.forEach((item, index) => {
        descriptor.add?.(target, item, index);
    });
};

const removeAll = (target: BackingInstance, descriptor: ArrayPropDescriptor, items: readonly unknown[]): void => {
    items.forEach((item, index) => {
        descriptor.remove?.(target, item, index);
    });
};
