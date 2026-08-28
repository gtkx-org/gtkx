import type { AnyClass } from "@gtkx/utils";
import {
    bindFunctionPointer,
    call,
    type CallDescriptor,
    type Descriptor,
    type ExternalObject,
    getType,
    type Handle,
    type Ref,
} from "@gtkx/native";
import {
    type ArrayDescriptor,
    type BoxedDescriptor,
    boxedT,
    type CallbackDescriptor,
    type FundamentalDescriptor,
    type HashTableDescriptor,
    isGtypeDescriptor,
    type ObjectDescriptor,
    refT,
    type StructDescriptor,
} from "./descriptors.js";
import { checkError } from "./error.js";
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
import { resolveDescriptorType } from "./type.js";

type MarshalledKind = "object" | "struct" | "boxed" | "fundamental" | "array" | "hashtable";
type MarshalledDescriptor = Extract<Descriptor, { kind: MarshalledKind }>;
type DecodedCallbackTarget = { fnPtr: bigint; userData?: bigint | undefined };

const MARSHALLED_KINDS: Set<Descriptor["kind"]> = new Set<MarshalledKind>([
    "object",
    "struct",
    "boxed",
    "fundamental",
    "array",
    "hashtable",
]);

const NULL_POINTER = 0n;

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
    target: DecodedCallbackTarget,
    inputs: unknown[],
): unknown[] {
    const values: unknown[] = [];
    let cursor = 0;

    for (const [index, argDescriptor] of descriptor.argDescriptors.entries()) {
        if (index === descriptor.userDataIndex) {
            values.push(target.userData ?? NULL_POINTER);
        } else {
            values.push(toNative(argDescriptor, inputs[cursor]));
            cursor += 1;
        }
    }

    return values;
}

function decodedCallbackCallable(
    descriptor: CallbackDescriptor,
    target: DecodedCallbackTarget,
): (...inputs: unknown[]) => unknown {
    const canThrow = descriptor.canThrow === true;
    const isOneShot = descriptor.scope === "async";
    const argDescriptors = canThrow ? [...descriptor.argDescriptors, errorRefDescriptor()] : descriptor.argDescriptors;
    let bound: ExternalObject<CallDescriptor> | undefined;
    let isSpent = false;

    return (...inputs) => {
        if (isSpent) {
            throw new Error("An async-scoped callback was already invoked; its native caller has released it");
        }

        bound ??= bindFunctionPointer(target.fnPtr, argDescriptors, descriptor.returnDescriptor, "decoded callback");
        const values = decodedCallbackValues(descriptor, target, inputs);
        isSpent = isOneShot;

        if (!canThrow) {
            return fromNative(descriptor.returnDescriptor, call(bound, values));
        }

        const errorRef: Ref = { value: null };
        values.push(errorRef);
        const result = call(bound, values);
        checkError(errorRef);

        return fromNative(descriptor.returnDescriptor, result);
    };
}

function callbackFromNative(descriptor: CallbackDescriptor, value: unknown): unknown {
    if (value == null) {
        return value;
    }

    const target = value as Partial<DecodedCallbackTarget>;

    if (typeof target.fnPtr !== "bigint") {
        return value;
    }

    return decodedCallbackCallable(descriptor, { fnPtr: target.fnPtr, userData: target.userData });
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
 * converting arrays and hash tables according to the descriptor. A callback
 * decoded from a native function pointer and its bound user data becomes a
 * callable function that invokes the native callback; it stays valid only as
 * long as the native caller keeps the pointer pair alive, which for an
 * async-scoped callback means until the first invocation — calling one a
 * second time throws instead of reaching the released native closure.
 *
 * @param descriptor Describes the native type of the value.
 * @param value The raw native value to convert.
 */
function fromNative(descriptor: Descriptor, value: unknown): unknown {
    if (descriptor.kind === "callback") {
        return callbackFromNative(descriptor, value);
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

export { fromNative, toNative };
