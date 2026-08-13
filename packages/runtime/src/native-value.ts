import type { Descriptor, ExternalObject, Handle } from "@gtkx/native";
import type { ArrayDescriptor, FundamentalDescriptor, HashTableDescriptor, StructDescriptor } from "./descriptors.js";
import { getHandle, getWrapperClass, wrapCallScopedObject, wrapHandle, wrapObject } from "./registry.js";
import { resolveDescriptorType } from "./type.js";

type MarshalledKind = "object" | "struct" | "boxed" | "fundamental" | "array" | "hashtable";
type MarshalledDescriptor = Extract<Descriptor, { kind: MarshalledKind }>;

const MARSHALLED_KINDS: Set<Descriptor["kind"]> = new Set<MarshalledKind>([
    "object",
    "struct",
    "boxed",
    "fundamental",
    "array",
    "hashtable",
]);

function isMarshalledDescriptor(descriptor: Descriptor): descriptor is MarshalledDescriptor {
    return MARSHALLED_KINDS.has(descriptor.kind);
}

function mapCollection(
    descriptor: ArrayDescriptor,
    value: unknown,
    convert: (itemDescriptor: Descriptor, item: unknown) => unknown,
): unknown[] {
    return (value as unknown[]).map((item) => convert(descriptor.itemDescriptor, item));
}

function collectionFromNative(descriptor: ArrayDescriptor, value: unknown): unknown {
    return value === null ? null : mapCollection(descriptor, value, fromNative);
}

function boxedFromNative(descriptor: Descriptor, value: unknown): unknown {
    return value == null
        ? null
        : wrapHandle(value as ExternalObject<Handle>, getWrapperClass(resolveDescriptorType(descriptor)));
}

function fundamentalFromNative(descriptor: FundamentalDescriptor, value: unknown): unknown {
    return value == null
        ? null
        : wrapHandle(
                value as ExternalObject<Handle>,
                descriptor.wrapperClass ?? getWrapperClass(resolveDescriptorType(descriptor)),
            );
}

function hashTableFromNative(descriptor: HashTableDescriptor, value: unknown): unknown {
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
}

/**
 * Converts a raw value returned from native code into its JavaScript form,
 * wrapping object, struct, boxed, and fundamental handles and recursively
 * converting arrays and hash tables according to the descriptor.
 *
 * @param descriptor Describes the native type of the value.
 * @param value The raw native value to convert.
 */
function fromNative(descriptor: Descriptor, value: unknown): unknown {
    if (!isMarshalledDescriptor(descriptor)) {
        return value;
    }

    switch (descriptor.kind) {
        case "object": {
            return descriptor.isCallScoped === true ? wrapCallScopedObject(value) : wrapObject(value);
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
    }
}

function collectionToNative(descriptor: ArrayDescriptor, value: unknown): unknown {
    return value == null ? null : mapCollection(descriptor, value, toNative);
}

function hashTableToNative(descriptor: HashTableDescriptor, value: unknown): unknown {
    if (value == null) {
        return null;
    }

    return [...(value as Map<unknown, unknown>)].map(([key, val]): [unknown, unknown] => [
        toNative(descriptor.keyDescriptor, key),
        toNative(descriptor.valueDescriptor, val),
    ]);
}

/**
 * Converts a JavaScript value into the raw form native code expects, unwrapping
 * object, struct, boxed, and fundamental wrappers back to their handles and
 * recursively converting arrays and maps according to the descriptor.
 *
 * @param descriptor Describes the native type to convert to.
 * @param value The JavaScript value to convert.
 */
function toNative(descriptor: Descriptor, value: unknown): unknown {
    if (!isMarshalledDescriptor(descriptor)) {
        return value;
    }

    switch (descriptor.kind) {
        case "object":
        case "struct":
        case "boxed":
        case "fundamental": {
            const instance = value as object | null | undefined;

            return instance == null ? null : getHandle(instance);
        }
        case "array": {
            return collectionToNative(descriptor, value);
        }
        case "hashtable": {
            return hashTableToNative(descriptor, value);
        }
    }
}

export { fromNative, toNative };
