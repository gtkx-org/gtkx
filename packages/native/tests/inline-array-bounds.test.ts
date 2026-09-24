import {
    alloc,
    bindField,
    type Descriptor,
    type ExternalObject,
    type FieldDescriptor,
    type Handle,
    read,
    readField,
    write,
    writeField,
} from "@gtkx/native";
import { describe, expect, test } from "vitest";

const INT32: Descriptor = { kind: "int32" };
const RECORD: Descriptor = { kind: "struct", ownership: "borrowed", size: 8 };
const INLINE: Descriptor = { ...RECORD, isInline: true };

const record = (value: number): ExternalObject<Handle> => {
    const handle = alloc(8);
    write(handle, INT32, 4, value);

    return handle;
};

const values = (field: ExternalObject<FieldDescriptor>, owner: ExternalObject<Handle>): unknown[] =>
    (readField(field, owner, 0) as ExternalObject<Handle>[]).map((entry) => read(entry, INT32, 4));

const arrayDescriptor = (arrayKind: "fixed" | "garray"): Descriptor => ({
    kind: "array",
    arrayKind,
    ownership: "full",
    itemDescriptor: RECORD,
    elementSize: 8,
    ...(arrayKind === "fixed" && { fixedSize: 2 }),
});

describe.each(["fixed", "garray"] as const)("%s inline array source bounds", (arrayKind) => {
    const descriptor = arrayDescriptor(arrayKind);

    test("copies exact allocations and bounded aliases independently", () => {
        const field = bindField(descriptor);
        const destination = alloc(8);
        const first = record(11);
        const owner = alloc(16);
        const alias = read(owner, INLINE, 8) as ExternalObject<Handle>;
        write(alias, INT32, 4, 22);

        try {
            writeField(field, destination, 0, [first, alias]);
            expect(values(field, destination)).toEqual([11, 22]);

            write(first, INT32, 4, 91);
            write(alias, INT32, 4, 92);
            expect(values(field, destination)).toEqual([11, 22]);
        } finally {
            writeField(field, destination, 0, null);
        }
    });

    test.each(["allocation", "field"] as const)("rejects an undersized %s without replacing the array", (source) => {
        const field = bindField(descriptor);
        const destination = alloc(8);
        const owner = alloc(16);
        const tooSmall = source === "allocation"
            ? alloc(7)
            : read(owner, { ...INLINE, size: 7 }, 8) as ExternalObject<Handle>;

        try {
            writeField(field, destination, 0, [record(31), record(32)]);

            expect(() => writeField(field, destination, 0, [record(41), tooSmall])).toThrow();
            expect(values(field, destination)).toEqual([31, 32]);
        } finally {
            writeField(field, destination, 0, null);
        }
    });

    test("rejects null elements and clears the whole array with null", () => {
        const field = bindField(descriptor);
        const destination = alloc(8);

        expect(readField(field, destination, 0)).toBeNull();
        try {
            writeField(field, destination, 0, [record(51), record(52)]);

            expect(() => writeField(field, destination, 0, [record(61), null])).toThrow();
            expect(values(field, destination)).toEqual([51, 52]);
        } finally {
            writeField(field, destination, 0, null);
        }
        expect(readField(field, destination, 0)).toBeNull();
    });
});

test("a fixed inline array rejects empty input without replacing its values", () => {
    const field = bindField(arrayDescriptor("fixed"));
    const destination = alloc(8);

    try {
        writeField(field, destination, 0, [record(71), record(72)]);

        expect(() => writeField(field, destination, 0, [])).toThrow();
        expect(values(field, destination)).toEqual([71, 72]);
    } finally {
        writeField(field, destination, 0, null);
    }
});

test("a GArray replaces its inline records with an empty array", () => {
    const field = bindField(arrayDescriptor("garray"));
    const destination = alloc(8);

    try {
        writeField(field, destination, 0, [record(71), record(72)]);
        writeField(field, destination, 0, []);
        expect(readField(field, destination, 0)).toEqual([]);
    } finally {
        writeField(field, destination, 0, null);
    }
});
