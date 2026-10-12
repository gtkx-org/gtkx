import type { Descriptor as NativeDescriptor, Ref, ReferenceMode } from "./native.js";
import { isArrayBuffer, isUint8Array } from "node:util/types";
import type { Descriptor } from "./descriptor-types.js";

type RefDescriptor = Extract<Descriptor, { kind: "ref" }>;
type Conversion = (value: unknown) => unknown;
type ReferenceRequest = {
    seed: unknown;
    mode: ReferenceMode;
    capacity?: bigint | undefined;
};
type ReferencePlan = {
    encode: (value: unknown) => ReferenceRequest | null | undefined;
    read: (value: unknown) => unknown;
    write: (value: unknown, replacement: unknown) => void;
};

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

const compileReferencePlan = (
    descriptor: RefDescriptor,
    inner: NativeDescriptor,
    convert: Conversion,
): ReferencePlan => {
    return {
        encode(value) {
            if (value == null) {
                return value;
            }
            const seed: unknown = Reflect.get(value, "value");
            if (inner.kind === "bytes" && inner.length !== undefined && inner.length !== null) {
                return {
                    seed: fixedBuffer(seed == null ? seed : convert(seed), inner.length),
                    mode: "fixedBytes",
                };
            }
            if (descriptor.inout === true) {
                return { seed: seed == null ? seed : convert(seed), mode: "inout" };
            }
            if (inner.kind === "array" && inner.isCallerAllocated) {
                return inner.arrayKind === "garray"
                    ? { seed: null, mode: "callerContainer" }
                    : { seed: null, mode: "callerArray", capacity: arrayCapacity(seed) };
            }
            if (seed == null) {
                return { seed: null, mode: "slot" };
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

            return { seed: encoded, mode };
        },
        read: (value) => (value as Ref).value,
        write(value, replacement) {
            (value as Ref).value = replacement;
        },
    };
};

export { compileReferencePlan, type ReferencePlan };
