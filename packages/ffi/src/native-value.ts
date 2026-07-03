import type { Descriptor, ExternalObject, Handle } from "@gtkx/native";
import type { ArrayDescriptor, StructDescriptor } from "./descriptors.js";
import { getWrapperClass, tryGetHandle, wrapHandle } from "./registry.js";
import { resolveDescriptorType } from "./type.js";

const collectionFromNativeValue = (descriptor: ArrayDescriptor, value: unknown): unknown => {
    if (value === null) return null;
    return (value as unknown[]).map((item) => fromNativeValue(descriptor.itemDescriptor, item));
};

export function fromNativeValue(descriptor: Descriptor, value: unknown): unknown {
    switch (descriptor.kind) {
        case "object":
            return wrapHandle(value as ExternalObject<Handle> | null, undefined);
        case "struct":
            return wrapHandle(value as ExternalObject<Handle> | null, (descriptor as StructDescriptor).wrapperClass);
        case "boxed":
        case "fundamental":
            return wrapHandle(
                value as ExternalObject<Handle> | null,
                getWrapperClass(resolveDescriptorType(descriptor)),
            );
        case "array":
            return collectionFromNativeValue(descriptor, value);
        case "hashtable": {
            if (value === null) return null;
            const entries = value as [unknown, unknown][];
            return new Map(
                entries.map(([key, val]): [unknown, unknown] => [
                    fromNativeValue(descriptor.keyDescriptor, key),
                    fromNativeValue(descriptor.valueDescriptor, val),
                ]),
            );
        }
        default:
            return value;
    }
}

const collectionToNativeValue = (descriptor: ArrayDescriptor, value: unknown): unknown => {
    if (value == null) return null;
    return (value as unknown[]).map((item) => toNativeValue(descriptor.itemDescriptor, item));
};

export function toNativeValue(descriptor: Descriptor, value: unknown): unknown {
    switch (descriptor.kind) {
        case "object":
        case "struct":
        case "boxed":
        case "fundamental":
            return tryGetHandle(value as object | null | undefined) ?? null;
        case "array":
            return collectionToNativeValue(descriptor, value);
        case "hashtable": {
            if (value == null) return null;
            return [...(value as Map<unknown, unknown>)].map(([key, val]): [unknown, unknown] => [
                toNativeValue(descriptor.keyDescriptor, key),
                toNativeValue(descriptor.valueDescriptor, val),
            ]);
        }
        default:
            return value;
    }
}
