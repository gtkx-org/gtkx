import type {
    ControlledTextRule,
    KeyedListRule,
    ListRule,
    ReassertRule,
    SelectionRule,
    SyntheticPropRule,
    ValueRule,
    WriteOnceListRule,
} from "@gtkx/config";
import type { TypedClass } from "@gtkx/ffi";
import { callMethod } from "@gtkx/utils";
import { runCall, syntheticRulesFor, writeTarget } from "./rule-table.js";
import type { Props } from "./types.js";

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const applyList = (instance: object, rule: ListRule, oldValue: unknown, newValue: unknown): void => {
    if (oldValue === newValue) return;
    runCall(instance, rule.clear, [], {});
    for (const item of asArray(newValue)) runCall(instance, rule.add, [item], { item });
};

const applyKeyedList = (instance: object, rule: KeyedListRule, oldValue: unknown, newValue: unknown): void => {
    if (oldValue === newValue) return;
    for (const item of asArray(oldValue)) runCall(instance, rule.remove, [item], { item });
    for (const item of asArray(newValue)) {
        runCall(instance, rule.add, [item], { item });
        if (rule.setters === undefined || rule.key === undefined) continue;
        const key = Reflect.get(Object(item), rule.key);
        for (const [field, method] of Object.entries(rule.setters)) {
            const fieldValue = Reflect.get(Object(item), field);
            if (fieldValue !== undefined) callMethod(instance, method, [key, fieldValue]);
        }
    }
};

const applyValue = (instance: object, rule: ValueRule, oldValue: unknown, newValue: unknown): void => {
    if (oldValue === newValue) return;
    let value = newValue;
    if (value == null && "or" in rule) value = rule.or;
    runCall(instance, rule.call, [value], { value, item: value });
    if (rule.then !== undefined) callMethod(instance, rule.then, []);
};

const applyWriteOnceList = (instance: object, rule: WriteOnceListRule, oldValue: unknown, newValue: unknown): void => {
    if (oldValue === newValue || asArray(oldValue).length !== 0) return;
    for (const item of asArray(newValue)) runCall(instance, rule.add, [item], { item });
};

const applyControlledText = (instance: object, rule: ControlledTextRule, oldValue: unknown, newValue: unknown): void => {
    if (oldValue === newValue || typeof newValue !== "string") return;
    if (oldValue !== undefined && callMethod(instance, rule.get, []) !== oldValue) return;
    writeTarget(instance, rule.set, newValue);
};

const applySelection = (instance: object, rule: SelectionRule, props: Props): void => {
    const value = props[rule.prop];
    if (value == null || value === "") return;
    if (callMethod(instance, rule.get, []) === value) return;
    if (rule.lookup !== undefined && !callMethod(instance, rule.lookup, [value])) return;
    writeTarget(instance, rule.set, value);
};

const applyReassert = (instance: object, rule: ReassertRule, props: Props): void => {
    const value = props[rule.prop];
    if (value == null) return;
    if (typeof rule.set === "string") writeTarget(instance, rule.set, value);
    else runCall(instance, rule.set, [value], { value, item: value });
};

const applyRule = (instance: object, rule: SyntheticPropRule, oldProps: Props | null, newProps: Props): void => {
    const oldValue = oldProps?.[rule.prop];
    const newValue = newProps[rule.prop];
    switch (rule.kind) {
        case "list":
            applyList(instance, rule, oldValue, newValue);
            return;
        case "keyed-list":
            applyKeyedList(instance, rule, oldValue, newValue);
            return;
        case "value":
            applyValue(instance, rule, oldValue, newValue);
            return;
        case "write-once-list":
            applyWriteOnceList(instance, rule, oldValue, newValue);
            return;
        case "controlled-text":
            applyControlledText(instance, rule, oldValue, newValue);
            return;
        case "selection":
            applySelection(instance, rule, newProps);
            return;
        case "reassert":
            applyReassert(instance, rule, newProps);
            return;
    }
};

export const applySyntheticProps = (instance: TypedClass & object, oldProps: Props | null, newProps: Props): void => {
    for (const rule of syntheticRulesFor(instance.__type__).values()) {
        applyRule(instance, rule, oldProps, newProps);
    }
};

export const reapplySelectionProps = (instance: TypedClass & object, props: Props): void => {
    for (const rule of syntheticRulesFor(instance.__type__).values()) {
        if (rule.kind === "selection") applySelection(instance, rule, props);
    }
};

export const hasSelectionProps = (instance: TypedClass & object): boolean => {
    for (const rule of syntheticRulesFor(instance.__type__).values()) {
        if (rule.kind === "selection") return true;
    }
    return false;
};
