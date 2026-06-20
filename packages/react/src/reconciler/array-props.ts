/// <reference types="@gtkx/config/env" />

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
import type { ArrayPropRow, ConstructStep } from "@gtkx/config";
import { constructWrapper } from "@gtkx/ffi";
import type * as GObject from "@gtkx/gi/gobject";
import { requireClassByName } from "../utils/gtype-predicates.js";
import { itemField, runCallStep, satisfiesCondition } from "./call-steps.js";
import { callMethod } from "./reflect-call.js";

/**
 * Describes how one array-valued prop reconciles its elements into GTK calls.
 * Apply order: `set` replaces the whole list in one call; otherwise old
 * elements are removed (`clear` once, else `remove` each) and new ones added
 * (`add` each). `appendOnce` marks an immutable list applied only when the
 * previous one was empty.
 */
export interface ArrayPropDescriptor {
    /** Discriminates this descriptor within the unified prop-descriptor view. */
    readonly kind: "array";
    /** Removes every previously-applied element in one call. */
    clear?(target: GObject.Object): void;
    /** Removes one previously-applied element. */
    remove?(target: GObject.Object, item: unknown): void;
    /** Adds one current element. */
    add?(target: GObject.Object, item: unknown): void;
    /** Replaces the whole list in one call (used when GTK has no per-element API). */
    set?(target: GObject.Object, items: readonly unknown[]): void;
    /** When true, the list is immutable: apply only when the previous list was empty. */
    appendOnce?: boolean;
}

const runConstructStep = (target: GObject.Object, step: ConstructStep, item: unknown): void => {
    const constructed = constructWrapper(requireClassByName(step.type), {});
    for (const setter of step.setters) {
        const value = itemField(item, setter.path);
        if (satisfiesCondition(value, setter.when)) callMethod(constructed, setter.method, [value]);
    }
    callMethod(target, step.attach, [constructed]);
};

const compileRow = (row: ArrayPropRow): ArrayPropDescriptor => {
    const descriptor: ArrayPropDescriptor = { kind: "array" };
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
    target: GObject.Object,
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

const addAll = (target: GObject.Object, descriptor: ArrayPropDescriptor, items: readonly unknown[]): void => {
    for (const item of items) descriptor.add?.(target, item);
};

const removeAll = (target: GObject.Object, descriptor: ArrayPropDescriptor, items: readonly unknown[]): void => {
    for (const item of items) descriptor.remove?.(target, item);
};
