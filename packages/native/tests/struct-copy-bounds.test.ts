import {
    alloc,
    bindField,
    copy,
    type Descriptor,
    type ExternalObject,
    type Handle,
    read,
    readField,
    write,
    writeField,
} from "@gtkx/native";
import { describe, expect, test } from "vitest";

const INT32: Descriptor = { kind: "int32" };
const POINTER: Descriptor = { kind: "struct", ownership: "borrowed" };
const RECORD: Descriptor = { ...POINTER, size: 8 };

const record = (size: number, value: number): ExternalObject<Handle> => {
    const handle = alloc(size);
    write(handle, INT32, size - 4, value);

    return handle;
};

describe.each(["bound", "unbound"] as const)("%s copied struct bounds", (mode) => {
    const readCopy = (owner: ExternalObject<Handle>, size: number): unknown => {
        const descriptor: Descriptor = { ...POINTER, size };

        return mode === "bound"
            ? readField(bindField(descriptor), owner, 0)
            : read(owner, descriptor, 0);
    };

    const snapshot = (source: ExternalObject<Handle>, size: number): ExternalObject<Handle> => {
        const owner = alloc(8);
        write(owner, POINTER, 0, source);

        return readCopy(owner, size) as ExternalObject<Handle>;
    };

    test("copies a borrowed field independently and permits its exact extent", () => {
        const original = record(8, 42);
        const copied = snapshot(original, 8);
        const destination = alloc(8);

        expect(read(copied, INT32, 4)).toBe(42);
        write(original, INT32, 4, 51);
        expect(read(copied, INT32, 4)).toBe(42);
        write(copied, INT32, 4, 63);
        expect(read(original, INT32, 4)).toBe(51);

        copy(destination, copied, 8);
        expect(read(destination, INT32, 4)).toBe(63);
        copy(copied, original, 8);
        expect(read(copied, INT32, 4)).toBe(51);
    });

    test("rejects field reads and writes beyond the copied extent", () => {
        const original = record(8, 42);
        const copied = snapshot(original, 8);
        const field = bindField(INT32);

        expect(() => read(copied, INT32, 5)).toThrow();
        expect(() => readField(field, copied, 5)).toThrow();
        expect(() => write(copied, INT32, 5, 99)).toThrow();
        expect(() => writeField(field, copied, 5, 99)).toThrow();
        expect(read(copied, INT32, 4)).toBe(42);
        expect(read(original, INT32, 4)).toBe(42);
    });

    test("rejects copies beyond either copied handle extent", () => {
        const original = record(8, 42);
        const copied = snapshot(original, 8);
        const other = alloc(16);
        write(other, INT32, 4, 71);

        expect(() => copy(other, copied, 9)).toThrow();
        expect(read(other, INT32, 4)).toBe(71);
        expect(() => copy(copied, other, 9)).toThrow();
        expect(read(copied, INT32, 4)).toBe(42);
    });

    test("an unsized inline alias inherits the copied allocation remainder", () => {
        const original = record(8, 42);
        const copied = snapshot(original, 8);
        const alias = read(copied, { ...POINTER, isInline: true }, 4) as ExternalObject<Handle>;

        expect(read(alias, INT32, 0)).toBe(42);
        write(alias, INT32, 0, 71);
        expect(read(copied, INT32, 4)).toBe(71);
        expect(read(original, INT32, 4)).toBe(42);
        expect(() => read(alias, INT32, 1)).toThrow();
        expect(() => write(alias, INT32, 1, 99)).toThrow();
        expect(read(alias, INT32, 0)).toBe(71);
    });

    test("a null borrowed field remains null", () => {
        const owner = alloc(8);

        expect(readCopy(owner, 8)).toBeNull();
    });

    test.each(["fixed", "garray"] as const)(
        "%s packing preserves a destination when a copied record is too small",
        (arrayKind) => {
            const descriptor: Descriptor = {
                kind: "array",
                arrayKind,
                ownership: "full",
                itemDescriptor: RECORD,
                elementSize: 8,
                ...(arrayKind === "fixed" && { fixedSize: 2 }),
            };
            const field = bindField(descriptor);
            const destination = alloc(8);
            const first = record(8, 31);
            const second = record(8, 32);
            const small = record(7, 43);
            const copied = snapshot(first, 8);
            const tooSmall = snapshot(small, 7);
            const values = () => (readField(field, destination, 0) as ExternalObject<Handle>[])
                .map((entry) => read(entry, INT32, 4));

            try {
                writeField(field, destination, 0, [copied, snapshot(second, 8)]);
                expect(values()).toEqual([31, 32]);
                expect(read(tooSmall, INT32, 3)).toBe(43);

                expect(() => writeField(field, destination, 0, [copied, tooSmall])).toThrow();
                expect(values()).toEqual([31, 32]);
                expect(read(tooSmall, INT32, 3)).toBe(43);
            } finally {
                writeField(field, destination, 0, null);
            }
        },
    );
});
