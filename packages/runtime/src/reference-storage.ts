import {
    compileReference,
    createReferenceStorage,
    type Descriptor as NativeDescriptor,
    type ExternalObject,
    type Ref,
    type ReferenceDescriptor,
    type ReferenceMode,
} from "./native.js";
import { isArrayBuffer, isUint8Array } from "node:util/types";
import type { Descriptor } from "./descriptor-types.js";

type RefDescriptor = Extract<Descriptor, { kind: "ref" }>;
type Conversion = (value: unknown) => unknown;
type ReferencePlan = {
    abi: NativeDescriptor;
    encode: (value: unknown, convert: Conversion) => unknown;
    read: (value: unknown) => unknown;
    write: (value: unknown, replacement: unknown) => void;
};

const references = new WeakMap<RefDescriptor, { signature: string; reference: ExternalObject<ReferenceDescriptor> }>();

const fixedBuffer = (value: unknown, length: number): Uint8Array => {
    if (length === 0) {
        throw new RangeError("A string reference needs room for its terminator");
    }
    const buffer = new Uint8Array(length);
    if (value == null) {
        return buffer;
    }
    if (!isUint8Array(value) || !isArrayBuffer(value.buffer)) {
        throw new TypeError("Expected a Uint8Array with an ArrayBuffer backing store");
    }
    buffer.set(value.subarray(0, length - 1));

    return buffer;
};

const arrayCapacity = (value: unknown): bigint | undefined => {
    if (value == null) {
        return undefined;
    }
    if (typeof value === "number") {
        if (!Number.isSafeInteger(value) || value < 0) {
            throw new RangeError("Caller-allocated array capacity must be a nonnegative safe integer");
        }

        return BigInt(value);
    }
    if (typeof value !== "bigint" || value < 0n) {
        throw new TypeError("Caller-allocated array capacity must be a nonnegative integer");
    }

    return value;
};

const compileReferenceStorage = (descriptor: RefDescriptor, inner: NativeDescriptor): ReferencePlan => {
    const signature = JSON.stringify(descriptor);
    const cached = references.get(descriptor);
    const reference =
        cached?.signature === signature ? cached.reference : compileReference(inner, descriptor.inout ?? false);
    references.set(descriptor, { signature, reference });

    return {
        abi: { kind: "reference", reference },
        encode(value, convert) {
            if (value == null) {
                return value;
            }
            const seed: unknown = Reflect.get(value, "value");
            if (inner.kind === "bytes" && inner.length !== undefined && inner.length !== null) {
                return createReferenceStorage(
                    reference,
                    fixedBuffer(seed == null ? seed : convert(seed), inner.length),
                    "fixedBytes",
                );
            }
            if (descriptor.inout === true) {
                return createReferenceStorage(reference, seed == null ? seed : convert(seed), "inout");
            }
            if (inner.kind === "array" && inner.isCallerAllocated) {
                return inner.arrayKind === "garray"
                    ? createReferenceStorage(reference, null, "callerContainer")
                    : createReferenceStorage(reference, null, "callerArray", arrayCapacity(seed));
            }
            if (seed == null) {
                return createReferenceStorage(reference, null, "slot");
            }
            if (inner.kind !== "array") {
                throw new TypeError(`Expected Null for Ref<${inner.kind}>`);
            }
            const encoded = convert(seed);
            let mode: ReferenceMode;
            if (inner.arrayKind === "gbytearray" && isUint8Array(encoded)) {
                mode = encoded.length === 0 ? "slot" : "arraySlot";
            } else if (Array.isArray(encoded) || ArrayBuffer.isView(encoded)) {
                mode = inner.arrayKind === "sized" || inner.arrayKind === "fixed" ? "arrayBuffer" : "arraySlot";
            } else {
                throw new TypeError("Expected Array, Null, or Undefined for Ref<Array>");
            }

            return createReferenceStorage(reference, encoded, mode);
        },
        read: (value) => (value as Ref).value,
        write(value, replacement) {
            (value as Ref).value = replacement;
        },
    };
};

export { compileReferenceStorage, type ReferencePlan };
