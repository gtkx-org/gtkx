import type { AppliedProp, Call, ControlledTextProp, LazyProp, ListProp, ValueProp } from "@gtkx/config";
import type { TypedClass } from "@gtkx/runtime";
import { callMethod, isRecord, isSameArrayBy, isShallowEqual } from "@gtkx/utils";
import { collectAppliedProps, runCall } from "./element-props.js";
import type { Props } from "./types.js";

const toArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const isListValueEqual = (oldValue: unknown, newValue: unknown): boolean => {
    if (oldValue === newValue) return true;
    return isSameArrayBy(toArray(oldValue), toArray(newValue), isShallowEqual);
};

const runAdd = (instance: object, add: Call | Call[], item: unknown): void => {
    if (Array.isArray(add)) {
        for (const call of add) runCall(instance, call, [item], { item });
        return;
    }
    runCall(instance, add, [item], { item });
};

const snapshotItems = (items: unknown[]): unknown[] => items.map((item) => (isRecord(item) ? { ...item } : item));

const appliedLists = new WeakMap<object, Map<string, unknown[]>>();

const rememberAppliedList = (instance: object, prop: string, items: unknown[]): void => {
    const byProp = appliedLists.get(instance) ?? new Map<string, unknown[]>();
    byProp.set(prop, snapshotItems(items));
    appliedLists.set(instance, byProp);
};

const applyList = (instance: object, prop: ListProp, newValue: unknown): void => {
    const applied = appliedLists.get(instance)?.get(prop.prop);
    const newItems = toArray(newValue);
    if (applied !== undefined && isListValueEqual(applied, newItems)) return;
    if (prop.clear !== undefined) {
        runCall(instance, prop.clear, [], {});
    } else if (prop.remove !== undefined) {
        for (const item of toArray(applied)) runCall(instance, prop.remove, [item], { item });
    } else if (toArray(applied).length !== 0) {
        return;
    }
    for (const item of newItems) runAdd(instance, prop.add, item);
    rememberAppliedList(instance, prop.prop, newItems);
};

const applyValue = (instance: object, prop: ValueProp, oldValue: unknown, newValue: unknown): void => {
    if (oldValue === newValue) return;
    runCall(instance, prop.call, [newValue], { item: newValue });
    if (prop.after !== undefined) callMethod(instance, prop.after, []);
};

const applyControlledText = (
    instance: object,
    prop: ControlledTextProp,
    oldValue: unknown,
    newValue: unknown,
): void => {
    if (oldValue === newValue || typeof newValue !== "string") return;
    if (oldValue !== undefined && Reflect.get(instance, prop.prop) !== oldValue) return;
    Reflect.set(instance, prop.prop, newValue);
};

const applyLazy = (instance: object, prop: LazyProp, props: Props): void => {
    const value = props[prop.prop];
    if (value == null || value === "") return;
    if (Reflect.get(instance, prop.prop) === value) return;
    if (prop.lookup !== undefined && !callMethod(instance, prop.lookup, [value])) return;
    Reflect.set(instance, prop.prop, value);
};

const applyProp = (instance: object, prop: AppliedProp, oldProps: Props | null, newProps: Props): void => {
    const oldValue = oldProps?.[prop.prop];
    const newValue = newProps[prop.prop];
    switch (prop.kind) {
        case "value":
            applyValue(instance, prop, oldValue, newValue);
            return;
        case "controlled-text":
            applyControlledText(instance, prop, oldValue, newValue);
            return;
        case "lazy":
            applyLazy(instance, prop, newProps);
            return;
        case "list":
            applyList(instance, prop, newValue);
            return;
    }
};

export const applyElementProps = (instance: TypedClass & object, oldProps: Props | null, newProps: Props): void => {
    for (const prop of collectAppliedProps(instance.__type__).values()) {
        applyProp(instance, prop, oldProps, newProps);
    }
};

export const reapplyLazyProps = (instance: TypedClass & object, props: Props): void => {
    for (const prop of collectAppliedProps(instance.__type__).values()) {
        if (prop.kind === "lazy") applyLazy(instance, prop, props);
    }
};
