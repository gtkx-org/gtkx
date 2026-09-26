import {
    bindField,
    type ExternalObject,
    type FieldDescriptor,
    type Handle,
    read as nativeRead,
    write as nativeWrite,
    readField,
    writeField,
} from "@gtkx/native";
import type { Descriptor } from "./descriptor-types.js";
import { compileDescriptor } from "./scalar-plan.js";

/**
 * A field of a native struct at a fixed offset, bound once against the descriptor its bytes are
 * marshalled through, so the descriptor is not parsed again on access.
 */
type Field = {
    /** Reads and decodes the field out of `handle`'s memory. */
    read: (handle: ExternalObject<Handle>) => unknown;
    /** Encodes `value` and writes it into the field of `handle`'s memory. */
    write: (handle: ExternalObject<Handle>, value: unknown) => void;
};

/**
 * A field of a native struct whose offset is supplied per access, bound once against the
 * descriptor its bytes are marshalled through, for walking records stored at a stride.
 */
type StridedField = {
    /** Reads and decodes the field `offset` bytes into `handle`'s memory. */
    read: (handle: ExternalObject<Handle>, offset: number) => unknown;
    /** Encodes `value` and writes it `offset` bytes into `handle`'s memory. */
    write: (handle: ExternalObject<Handle>, offset: number, value: unknown) => void;
};

type FixedArrayValue<T> = {
    readonly length: number;
    entries: () => Iterable<[number, T]>;
};

const fixedArrayEntries = <T>(value: FixedArrayValue<T>, expectedLength: number): Iterable<[number, T]> => {
    if (value.length !== expectedLength) {
        throw new RangeError(
            `Expected an array of exactly ${String(expectedLength)} elements, got ${String(value.length)}`,
        );
    }

    return value.entries();
};

/**
 * Compiles a struct field descriptor once, with a byte offset supplied on each access.
 * Use it to walk consecutive records in a buffer; use {@link field} for a fixed offset.
 *
 * @param descriptor Describes how the field's bytes are marshalled.
 * @returns Read/write accessors accepting a handle and byte offset.
 */
const fieldAt = (descriptor: Descriptor): StridedField => {
    const plan = compileDescriptor(descriptor);
    const bound: ExternalObject<FieldDescriptor> = bindField(plan.abi);

    return {
        read: (handle, offset) => plan.decode(readField(bound, handle, offset)),
        write: (handle, offset, value) => {
            writeField(bound, handle, offset, plan.encode(value));
        },
    };
};

/**
 * Compiles a struct field descriptor once and binds it to a fixed byte offset.
 * Use `read` and `write` when the descriptor is only known at each access; they compile it each time.
 *
 * @param descriptor Describes how the field's bytes are marshalled.
 * @param offset Byte offset of the field within its owner's memory.
 * @returns Read/write accessors accepting the field's owner handle.
 */
const field = (descriptor: Descriptor, offset: number): Field => {
    if (!Number.isSafeInteger(offset) || offset < 0) {
        throw new RangeError(`A field offset must be a safe whole byte count, got ${String(offset)}`);
    }

    const bound = fieldAt(descriptor);

    return {
        read: (handle) => bound.read(handle, offset),
        write: (handle, value) => {
            bound.write(handle, offset, value);
        },
    };
};

const read = (handle: ExternalObject<Handle>, descriptor: Descriptor, offset: number): unknown => {
    const plan = compileDescriptor(descriptor);

    return plan.decode(nativeRead(handle, plan.abi, offset));
};

const write = (handle: ExternalObject<Handle>, descriptor: Descriptor, offset: number, value: unknown): void => {
    const plan = compileDescriptor(descriptor);
    nativeWrite(handle, plan.abi, offset, plan.encode(value));
};

export { read, write, field, type Field, fieldAt, fixedArrayEntries, type StridedField };
