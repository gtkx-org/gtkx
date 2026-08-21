import type { Lookup } from "@react-spring/types";
import * as Gtk from "@gtkx/gi/gtk";
import { applyStyle, applyWrite } from "@gtkx/react/internal";
import { coerceObjectProperty } from "@gtkx/runtime";

const setterCache: WeakMap<object, Map<string, boolean>> = new WeakMap();

const hasSetterInChain = (prototype: object | null, name: string): boolean => {
    for (let current = prototype; current !== null; current = Object.getPrototypeOf(current) as object | null) {
        const descriptor = Object.getOwnPropertyDescriptor(current, name);

        if (descriptor !== undefined) {
            return descriptor.set !== undefined;
        }
    }

    return false;
};

const hasSetter = (instance: object, name: string): boolean => {
    const prototype = Object.getPrototypeOf(instance) as object | null;

    if (prototype === null) {
        return false;
    }

    let known = setterCache.get(prototype);

    if (known === undefined) {
        known = new Map();
        setterCache.set(prototype, known);
    }

    let isWritable = known.get(name);

    if (isWritable === undefined) {
        isWritable = hasSetterInChain(prototype, name);
        known.set(name, isWritable);
    }

    return isWritable;
};

const isText = (value: unknown): value is string | number => typeof value === "string" || typeof value === "number";

const getText = (value: unknown): string | null => {
    if (isText(value)) {
        return String(value);
    }

    if (!Array.isArray(value)) {
        return null;
    }

    const texts = value.map((item) => getText(item));

    return texts.every((item) => item !== null) ? texts.join("") : null;
};

const didApplyText = (instance: object, value: unknown): boolean => {
    const text = getText(value);

    if (text === null || !(instance instanceof Gtk.Label)) {
        return false;
    }

    applyWrite(() => {
        instance.setLabel(text);
    });

    return true;
};

const didApplyStyle = (instance: object, value: unknown): boolean => {
    if (!(instance instanceof Gtk.Widget)) {
        return false;
    }

    applyStyle(instance, value);

    return true;
};

const didApplyValue = (instance: object, name: string, value: unknown): boolean => {
    if (name === "children") {
        return didApplyText(instance, value);
    }

    if (name === "style") {
        return didApplyStyle(instance, value);
    }

    if (!hasSetter(instance, name)) {
        return false;
    }

    applyWrite(() => {
        Reflect.set(instance, name, coerceObjectProperty(instance, name, value));
    });

    return true;
};

const didApplyAnimatedValues = (instance: object, values: Lookup): boolean => {
    let isApplied = true;

    for (const name in values) {
        if (!didApplyValue(instance, name, values[name])) {
            isApplied = false;
        }
    }

    return isApplied;
};

export { didApplyAnimatedValues };
