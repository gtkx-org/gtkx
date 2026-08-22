import {
    bindField,
    type Descriptor,
    type ExternalObject,
    type FieldDescriptor,
    type Handle,
    readField,
    writeField,
} from "@gtkx/native";

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

/**
 * Binds a struct field whose offset is only known per access, compiling `descriptor` once into an
 * accessor that reads and writes it wherever it is pointed. Use it to walk records stored one
 * after another in a buffer; {@link field} is the one to reach for when the offset is fixed.
 *
 * @param descriptor Describes how the field's bytes are marshalled.
 * @returns An accessor reading and writing that field at any offset of any handle it is given.
 */
const fieldAt = (descriptor: Descriptor): StridedField => {
    const bound: ExternalObject<FieldDescriptor> = bindField(descriptor);

    return {
        read: (handle, offset) => readField(bound, handle, offset),
        write: (handle, offset, value) => {
            writeField(bound, handle, offset, value);
        },
    };
};

/**
 * Binds a struct field at a fixed offset, compiling `descriptor` once into an accessor that reads
 * and writes it. The `read` and `write` functions compile the descriptor on every call instead, so
 * they remain the ones to reach for when a descriptor is only known per access.
 *
 * @param descriptor Describes how the field's bytes are marshalled.
 * @param offset Byte offset of the field within its owner's memory.
 * @returns An accessor reading and writing that field of any handle it is given.
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

export { field, type Field, fieldAt, type StridedField };
