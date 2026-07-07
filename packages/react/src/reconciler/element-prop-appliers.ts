import type { AppliedProp, ControlledTextProp, LazyProp, ListProp, ValueProp } from "@gtkx/config";
import type { TypedClass } from "@gtkx/ffi";
import { callMethod } from "@gtkx/utils";
import { appliedPropsFor, runCall } from "./element-props.js";
import type { Props } from "./types.js";

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const applyList = (instance: object, prop: ListProp, oldValue: unknown, newValue: unknown): void => {
    if (oldValue === newValue) return;
    const newItems = asArray(newValue);
    if (prop.clear !== undefined) {
        runCall(instance, prop.clear, [], {});
        for (const item of newItems) runCall(instance, prop.add, [item], { item });
        return;
    }
    if (prop.remove !== undefined) {
        for (const item of asArray(oldValue)) runCall(instance, prop.remove, [item], { item });
        for (const item of newItems) runCall(instance, prop.add, [item], { item });
        return;
    }
    if (asArray(oldValue).length !== 0) return;
    for (const item of newItems) runCall(instance, prop.add, [item], { item });
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
            applyList(instance, prop, oldValue, newValue);
            return;
    }
};

export const applyElementProps = (instance: TypedClass & object, oldProps: Props | null, newProps: Props): void => {
    for (const prop of appliedPropsFor(instance.__type__).values()) {
        applyProp(instance, prop, oldProps, newProps);
    }
};

export const reapplyLazyProps = (instance: TypedClass & object, props: Props): void => {
    for (const prop of appliedPropsFor(instance.__type__).values()) {
        if (prop.kind === "lazy") applyLazy(instance, prop, props);
    }
};
