import type { ArrayDescriptor, Descriptor, Handle, Value } from "@gtkx/native";
import { getDescriptorWrapperClass } from "./descriptors.js";
import { gtypeFromDescriptor } from "./gvalue.js";
import { requireWrapperClass, tryGetHandle, wrapHandle } from "./registry.js";

const collectionFromNativeValue = (descriptor: ArrayDescriptor, value: unknown): unknown => {
    if (value === null) return null;
    return (value as Value[]).map((item) => fromNativeValue(descriptor.itemType, item));
};

const wrapByDescriptorClass = (descriptor: Descriptor, value: Handle | null): object | null => {
    if (value === null) return null;
    const paired = getDescriptorWrapperClass(descriptor);
    if (paired !== undefined) return wrapHandle(value, paired);
    return wrapHandle(value, requireWrapperClass(gtypeFromDescriptor(descriptor)));
};

export function fromNativeValue(descriptor: Descriptor, value: Value): unknown {
    switch (descriptor.kind) {
        case "gobject":
            return wrapHandle(value as Handle | null, undefined);
        case "struct":
            return wrapHandle(value as Handle | null, getDescriptorWrapperClass(descriptor));
        case "boxed":
        case "fundamental":
            return wrapByDescriptorClass(descriptor, value as Handle | null);
        case "array":
            return collectionFromNativeValue(descriptor, value);
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

const collectionToNativeValue = (descriptor: ArrayDescriptor, value: unknown): Value => {
    if (value == null) return null;
    return (value as unknown[]).map((item) => toNativeValue(descriptor.itemType, item));
};

export function toNativeValue(descriptor: Descriptor, value: unknown): Value {
    switch (descriptor.kind) {
        case "gobject":
        case "struct":
        case "boxed":
        case "fundamental":
            return tryGetHandle(value as object | null | undefined) ?? null;
        case "array":
            return collectionToNativeValue(descriptor, value);
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
