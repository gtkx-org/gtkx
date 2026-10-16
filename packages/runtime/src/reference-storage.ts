import { alloc, type Descriptor as NativeDescriptor, type Ref } from "./native.js";
import { isArrayBuffer, isUint8Array } from "node:util/types";
import type { Descriptor } from "./descriptor-types.js";
import { scalarStorageSize } from "./output-storage.js";

type RefDescriptor = Extract<Descriptor, { kind: "ref" }>;
type Conversion = (value: unknown) => unknown;
type ReferencePlan = {
    encode: (value: unknown) => Ref | null | undefined;
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

const arrayCapacity = (value: unknown): number => {
    const capacity = typeof value === "bigint" ? Number(value) : value;
    if (typeof capacity !== "number" || !Number.isSafeInteger(capacity) || capacity < 0) {
        throw new RangeError("Caller-allocated array capacity must be a nonnegative safe integer");
    }
    return capacity;
};

const allocateArray = (descriptor: Extract<NativeDescriptor, { kind: "array" }>, capacity: unknown): Ref => {
    if (descriptor.arrayKind === "garray") {
        return { value: null };
    }
    const item = descriptor.itemDescriptor;
    const isHandle =
        item.kind === "object" || item.kind === "struct" || item.kind === "boxed" || item.kind === "fundamental";
    const stride = isHandle ? (descriptor.elementSize ?? 8) : (scalarStorageSize(item) ?? 8);
    const length = arrayCapacity(descriptor.arrayKind === "fixed" ? descriptor.fixedSize : capacity);
    const bytes = (length + Number(descriptor.isZeroTerminated)) * stride;
    if (!Number.isSafeInteger(bytes) || bytes > 134_217_728) {
        throw new RangeError("Caller-allocated array size exceeds the supported range");
    }
    return { value: alloc(bytes) };
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
                    value: fixedBuffer(seed == null ? seed : convert(seed), inner.length),
                };
            }
            if (descriptor.inout === true) {
                return { value: seed == null ? seed : convert(seed) };
            }
            if (inner.kind === "array" && inner.isCallerAllocated) {
                return allocateArray(inner, seed);
            }
            if (seed == null) {
                return { value: null };
            }
            if (inner.kind !== "array") {
                throw new TypeError(`Expected Null for Ref<${inner.kind}>`);
            }
            const encoded = convert(seed);
            if (inner.arrayKind === "gbytearray" && isUint8Array(encoded) && encoded.length === 0) {
                return { value: null };
            }
            if (!Array.isArray(encoded) && !ArrayBuffer.isView(encoded)) {
                throw new TypeError("Expected Array, Null, or Undefined for Ref<Array>");
            }
            return { value: encoded };
        },
        read: (value) => (value as Ref).value,
        write(value, replacement) {
            (value as Ref).value = replacement;
        },
    };
};

export { compileReferencePlan, type ReferencePlan };
