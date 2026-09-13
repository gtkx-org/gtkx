import type { AnyClass } from "@gtkx/utils";
import {
    bindFunctionPointer,
    type DecodedCallback,
    type ExternalObject,
    getType,
    type Handle,
    type Ref,
} from "@gtkx/native";
import type { Descriptor } from "./descriptor-types.js";
import { createCall } from "./call.js";
import {
    type ArrayDescriptor,
    type BoxedDescriptor,
    boxedT,
    bufferT,
    type CallbackDescriptor,
    type FundamentalDescriptor,
    type HashTableDescriptor,
    isGtypeDescriptor,
    type ObjectDescriptor,
    refT,
    type StructDescriptor,
} from "./descriptors.js";
import { checkError } from "./error.js";
import { normalizeHashTableEntries } from "./hash-table.js";
import { LIB } from "./library.js";
import {
    coerceGType,
    getHandle,
    getWrapperClass,
    resolveWrapperClass,
    wrapCallScopedObject,
    wrapFundamentalHandle,
    wrapHandle,
    wrapObject,
} from "./registry.js";
import { toAbi } from "./scalar-plan.js";
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
    if (value == null) {
        return null;
    }

    const handle = value as ExternalObject<Handle>;
    const type = resolveDescriptorType(descriptor);
    const registered = resolveWrapperClass(type);

    if (registered !== null) {
        return wrapHandle(handle, registered);
    }

    const fallback = (descriptor as BoxedDescriptor).fallbackClass?.();

    if (fallback !== undefined) {
        return wrapHandle(handle, fallback);
    }

    return wrapHandle(handle, getWrapperClass(type));
}

function fundamentalWrapperClass(descriptor: FundamentalDescriptor, handle: ExternalObject<Handle>): AnyClass {
    if (descriptor.wrapperClass !== undefined) {
        return descriptor.wrapperClass;
    }

    const declaredType = resolveDescriptorType(descriptor);
    const registered = resolveWrapperClass(getType(handle, declaredType));

    if (registered !== null) {
        return registered;
    }

    const fallback = descriptor.fallbackClass?.();

    if (fallback !== undefined) {
        return fallback;
    }

    return getWrapperClass(declaredType);
}

function fundamentalFromNative(descriptor: FundamentalDescriptor, value: unknown): unknown {
    if (value == null) {
        return null;
    }

    const handle = value as ExternalObject<Handle>;

    return wrapFundamentalHandle(handle, fundamentalWrapperClass(descriptor, handle));
}

const errorRefDescriptor = (): Descriptor =>
    refT(boxedT("GError", { ownership: "full", sharedLibrary: LIB, getTypeFnName: "g_error_get_type" }));

function decodedCallbackValues(
    descriptor: CallbackDescriptor,
    target: DecodedCallback,
    inputs: unknown[],
): unknown[] {
    const values: unknown[] = [];
    let cursor = 0;

    for (const [index, argDescriptor] of descriptor.argDescriptors.entries()) {
        if (index === descriptor.userDataIndex) {
            values.push(target.userData);
        } else {
            values.push(toNative(argDescriptor, inputs[cursor]));
            cursor += 1;
        }
    }

    return values;
}

function decodedCallbackCallable(
    descriptor: CallbackDescriptor,
    target: DecodedCallback,
): (...inputs: unknown[]) => unknown {
    const canThrow = descriptor.canThrow === true;
    const callbackArgs = descriptor.argDescriptors.map((arg, index) =>
        index === descriptor.userDataIndex ? bufferT : arg,
    );
    const argDescriptors = canThrow ? [...callbackArgs, errorRefDescriptor()] : callbackArgs;
    let invoke: ReturnType<typeof createCall> | undefined;

    return (...inputs) => {
        invoke ??= createCall(
            bindFunctionPointer(
                target.function, argDescriptors.map((argument) => toAbi(argument)),
                toAbi(descriptor.returnDescriptor), "decoded callback",
            ),
            argDescriptors,
            descriptor.returnDescriptor,
        );
        const values = decodedCallbackValues(descriptor, target, inputs);

        if (!canThrow) {
            return fromNative(descriptor.returnDescriptor, invoke(values));
        }

        const errorRef: Ref = { value: null };
        values.push(errorRef);
        const result = invoke(values);
        checkError(errorRef);

        return fromNative(descriptor.returnDescriptor, result);
    };
}

function callbackFromNative(descriptor: CallbackDescriptor, value: DecodedCallback | null): unknown {
    return value === null ? null : decodedCallbackCallable(descriptor, value);
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
    if (descriptor.kind === "callback") {
        return callbackFromNative(descriptor, value as DecodedCallback | null);
    }

    if (!isMarshalledDescriptor(descriptor)) {
        return value;
    }

    switch (descriptor.kind) {
        case "object": {
            const fallbackClass = (descriptor as ObjectDescriptor).fallbackClass;

            return descriptor.isCallScoped === true
                ? wrapCallScopedObject(value, fallbackClass)
                : wrapObject(value, fallbackClass);
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

/**
 * Normalises the JavaScript form of a hash table argument into its entry list. A `Map` is the
 * expected form and any other iterable of pairs is accepted; anything else is rejected, a plain
 * object above all, which `Array.from` would quietly flatten into an empty table.
 *
 * @param value The JavaScript value passed for a hash table argument.
 */
function toHashTableEntries(value: unknown): [unknown, unknown][] | null {
    return normalizeHashTableEntries(value);
}

function hashTableToNative(descriptor: HashTableDescriptor, value: unknown): unknown {
    const entries = normalizeHashTableEntries(value);

    if (entries === null) {
        return null;
    }

    return entries.map(([key, val]): [unknown, unknown] => [
        toNative(descriptor.keyDescriptor, key),
        toNative(descriptor.valueDescriptor, val),
    ]);
}

/**
 * Converts a JavaScript value into the raw form native code expects, unwrapping
 * object, struct, boxed, and fundamental wrappers back to their handles,
 * resolving a class passed for a GType to the GType it was registered under, and
 * recursively converting arrays and maps according to the descriptor.
 *
 * @param descriptor Describes the native type to convert to.
 * @param value The JavaScript value to convert.
 */
function toNative(descriptor: Descriptor, value: unknown): unknown {
    if (isGtypeDescriptor(descriptor)) {
        return coerceGType(value);
    }

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

export { fromNative, toHashTableEntries, toNative };
