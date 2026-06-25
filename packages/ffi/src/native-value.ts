import type { ArrayType, Handle, Type, Value } from "@gtkx/native";
import { getDescriptorWrapperClass } from "./descriptors.js";
import { resolveBoxedGtype } from "./gvalue.js";
import { requireWrapperClass, tryGetHandle, wrapHandle } from "./registry.js";

const wrapCollection = (descriptor: ArrayType, value: unknown): unknown => {
    if (value === null) return null;
    return (value as Value[]).map((item) => fromNativeValue(descriptor.itemType, item));
};

const wrapBoxedValue = (descriptor: Type, value: Handle | null): object | null => {
    if (value === null) return null;
    const paired = getDescriptorWrapperClass(descriptor);
    if (paired !== undefined) return wrapHandle(value, paired);
    return wrapHandle(value, requireWrapperClass(resolveBoxedGtype(descriptor)));
};

export function fromNativeValue(descriptor: Type, value: Value): unknown {
    switch (descriptor.type) {
        case "gobject":
            return wrapHandle(value as Handle | null, undefined);
        case "struct":
            return wrapHandle(value as Handle | null, getDescriptorWrapperClass(descriptor));
        case "boxed":
        case "fundamental":
            return wrapBoxedValue(descriptor, value as Handle | null);
        case "array":
            return wrapCollection(descriptor, value);
        case "hashtable": {
            if (value === null) return null;
            const entries = value as [Value, Value][];
            return new Map(
                entries.map(([key, val]): [unknown, unknown] => [
                    fromNativeValue(descriptor.keyType, key),
                    fromNativeValue(descriptor.valueType, val),
                ]),
            );
        }
        default:
            return value;
    }
}

const unwrapCollection = (descriptor: ArrayType, value: unknown): Value => {
    if (value == null) return null;
    return (value as unknown[]).map((item) => toNativeValue(descriptor.itemType, item));
};

export function toNativeValue(descriptor: Type, value: unknown): Value {
    switch (descriptor.type) {
        case "gobject":
        case "struct":
        case "boxed":
        case "fundamental":
            return tryGetHandle(value as object | null | undefined) ?? null;
        case "array":
            return unwrapCollection(descriptor, value);
        case "hashtable": {
            if (value == null) return null;
            return [...(value as Map<unknown, unknown>)].map(([key, val]): [Value, Value] => [
                toNativeValue(descriptor.keyType, key),
                toNativeValue(descriptor.valueType, val),
            ]);
        }
        default:
            return value as Value;
    }
}
