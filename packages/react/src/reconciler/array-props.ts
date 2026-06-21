/// <reference types="@gtkx/config/env" />

import { ARRAY_PROPS as ARRAY_PROP_ROWS } from "virtual:gtkx-config";
import type { ArrayPropRow, ConstructStep, PerElementPropRows } from "@gtkx/config";
import { constructWrapper } from "@gtkx/ffi";
import type * as GObject from "@gtkx/gi/gobject";
import { requireClassByName } from "../utils/gtype-predicates.js";
import { itemField, runCallStep, satisfiesCondition } from "./call-steps.js";
import type { PropDiffOverride } from "./prop-diff.js";
import { invokeRequiredMethod } from "./reflect-call.js";

export interface ArrayPropDescriptor extends PropDiffOverride {
    kind: "array";
    clear?(target: GObject.Object): void;
    remove?(target: GObject.Object, item: unknown): void;
    add?(target: GObject.Object, item: unknown): void;
    set?(target: GObject.Object, items: unknown[]): void;
    appendOnce?: boolean;
}

const runConstructStep = (target: GObject.Object, step: ConstructStep, item: unknown): void => {
    const constructed = constructWrapper(requireClassByName(step.type), {});
    for (const setter of step.setters) {
        const value = itemField(item, setter.path);
        if (satisfiesCondition(value, setter.when)) invokeRequiredMethod(constructed, setter.method, [value]);
    }
    invokeRequiredMethod(target, step.attach, [constructed]);
};

const compileRow = (row: ArrayPropRow): ArrayPropDescriptor => {
    const descriptor: ArrayPropDescriptor = { kind: "array" };
    const { clear, remove, add, construct, set } = row;
    if (set !== undefined) descriptor.set = (target, items) => invokeRequiredMethod(target, set, [items]);
    if (row.appendOnce) descriptor.appendOnce = true;
    if (clear !== undefined) descriptor.clear = (target) => invokeRequiredMethod(target, clear, []);
    if (remove !== undefined) descriptor.remove = (target, item) => runCallStep(target, remove, item);
    if (add !== undefined) {
        descriptor.add = (target, item) => {
            for (const step of add) runCallStep(target, step, item);
        };
    }
    if (construct !== undefined) descriptor.add = (target, item) => runConstructStep(target, construct, item);
    return descriptor;
};

const compileRows = (): PerElementPropRows<ArrayPropDescriptor> => {
    const compiled: Record<string, Record<string, ArrayPropDescriptor>> = {};
    for (const [typeName, props] of Object.entries(ARRAY_PROP_ROWS)) {
        const entry: Record<string, ArrayPropDescriptor> = {};
        for (const [prop, row] of Object.entries(props)) entry[prop] = compileRow(row);
        compiled[typeName] = entry;
    }
    return compiled;
};

export const ARRAY_PROPS: PerElementPropRows<ArrayPropDescriptor> = compileRows();

const toArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

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

const addAll = (target: GObject.Object, descriptor: ArrayPropDescriptor, items: unknown[]): void => {
    for (const item of items) descriptor.add?.(target, item);
};

const removeAll = (target: GObject.Object, descriptor: ArrayPropDescriptor, items: unknown[]): void => {
    for (const item of items) descriptor.remove?.(target, item);
};
