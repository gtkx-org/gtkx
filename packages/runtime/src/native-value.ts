import type { Descriptor, ExternalObject, Handle } from "@gtkx/native";
import type { ArrayDescriptor, FundamentalDescriptor, HashTableDescriptor, StructDescriptor } from "./descriptors.js";
import { getWrapperClass, tryGetHandle, wrapHandle } from "./registry.js";
import { resolveDescriptorType } from "./type.js";

const mapCollection = (
    descriptor: ArrayDescriptor,
    value: unknown,
    convert: (itemDescriptor: Descriptor, item: unknown) => unknown,
): unknown[] => (value as unknown[]).map((item) => convert(descriptor.itemDescriptor, item));

const collectionFromNative = (descriptor: ArrayDescriptor, value: unknown): unknown =>
    value === null ? null : mapCollection(descriptor, value, fromNative);

const boxedFromNative = (descriptor: Descriptor, value: unknown): unknown =>
    value == null
        ? null
        : wrapHandle(value as ExternalObject<Handle>, getWrapperClass(resolveDescriptorType(descriptor)));

const fundamentalFromNative = (descriptor: FundamentalDescriptor, value: unknown): unknown =>
    value == null
        ? null
        : wrapHandle(
                value as ExternalObject<Handle>,
                descriptor.wrapperClass ?? getWrapperClass(resolveDescriptorType(descriptor)),
            );

const hashTableFromNative = (descriptor: HashTableDescriptor, value: unknown): unknown => {
    if (value === null) {
        return null;
    }

    const entries = value as [unknown, unknown][];

    return new Map(
        entries.map(([key, val]): [unknown, unknown] => [
            fromNative(descriptor.keyDescriptor, key),
            fromNative(descriptor.valueDescriptor, val),
        ]),
    );
};

/**
 * Converts a raw value returned from native code into its JavaScript form,
 * wrapping object, struct, boxed, and fundamental handles and recursively
 * converting arrays and hash tables according to the descriptor.
 *
 * @param descriptor Describes the native type of the value.
 * @param value The raw native value to convert.
 */
function fromNative(descriptor: Descriptor, value: unknown): unknown {
    switch (descriptor.kind) {
        case "object": {
            return wrapHandle(value as ExternalObject<Handle> | null);
        }
        case "struct": {
            return wrapHandle(value as ExternalObject<Handle> | null, (descriptor as StructDescriptor).wrapperClass);
        }
        case "boxed": {
            return boxedFromNative(descriptor, value);
        }
        case "fundamental": {
            return fundamentalFromNative(descriptor, value);
        }
        case "array": {
            return collectionFromNative(descriptor, value);
        }
        case "hashtable": {
            return hashTableFromNative(descriptor, value);
        }
        default: {
            return value;
        }
    }
}

const collectionToNative = (descriptor: ArrayDescriptor, value: unknown): unknown =>
    value == null ? null : mapCollection(descriptor, value, toNative);

function toNative(descriptor: Descriptor, value: unknown): unknown {
    switch (descriptor.kind) {
        case "object":
        case "struct":
        case "boxed":
        case "fundamental": {
            return tryGetHandle(value as object | null | undefined) ?? null;
        }
        case "array": {
            return collectionToNative(descriptor, value);
        }
        case "hashtable": {
            if (value == null) {
                return null;
            }

            return [...(value as Map<unknown, unknown>)].map(([key, val]): [unknown, unknown] => [
                toNative(descriptor.keyDescriptor, key),
                toNative(descriptor.valueDescriptor, val),
            ]);
        }
        default: {
            return value;
        }
    }
}

export { fromNative, toNative };
