import type { Descriptor, ExternalObject, Handle } from "@gtkx/native";
import type { ArrayDescriptor, FundamentalDescriptor, StructDescriptor } from "./descriptors.js";
import { getWrapperClass, tryGetHandle, wrapHandle } from "./registry.js";
import { resolveDescriptorType } from "./type.js";

const collectionFromNative = (descriptor: ArrayDescriptor, value: unknown): unknown => {
    if (value === null) return null;
    return (value as unknown[]).map((item) => fromNative(descriptor.itemDescriptor, item));
};

export function fromNative(descriptor: Descriptor, value: unknown): unknown {
    switch (descriptor.kind) {
        case "object":
            return wrapHandle(value as ExternalObject<Handle> | null, undefined);
        case "struct":
            return wrapHandle(value as ExternalObject<Handle> | null, (descriptor as StructDescriptor).wrapperClass);
        case "boxed":
            return wrapHandle(
                value as ExternalObject<Handle> | null,
                getWrapperClass(resolveDescriptorType(descriptor)),
            );
        case "fundamental":
            return wrapHandle(
                value as ExternalObject<Handle> | null,
                (descriptor as FundamentalDescriptor).wrapperClass ??
                    getWrapperClass(resolveDescriptorType(descriptor)),
            );
        case "array":
            return collectionFromNative(descriptor, value);
        case "hashtable": {
            if (value === null) return null;
            const entries = value as [unknown, unknown][];
            return new Map(
                entries.map(([key, val]): [unknown, unknown] => [
                    fromNative(descriptor.keyDescriptor, key),
                    fromNative(descriptor.valueDescriptor, val),
                ]),
            );
        }
        default:
            return value;
    }
}

const collectionToNative = (descriptor: ArrayDescriptor, value: unknown): unknown => {
    if (value == null) return null;
    return (value as unknown[]).map((item) => toNative(descriptor.itemDescriptor, item));
};

export function toNative(descriptor: Descriptor, value: unknown): unknown {
    switch (descriptor.kind) {
        case "object":
        case "struct":
        case "boxed":
        case "fundamental":
            return tryGetHandle(value as object | null | undefined) ?? null;
        case "array":
            return collectionToNative(descriptor, value);
        case "hashtable": {
            if (value == null) return null;
            return [...(value as Map<unknown, unknown>)].map(([key, val]): [unknown, unknown] => [
                toNative(descriptor.keyDescriptor, key),
                toNative(descriptor.valueDescriptor, val),
            ]);
        }
        default:
            return value;
    }
}
