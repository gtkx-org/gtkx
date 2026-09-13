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

const INLINE: Descriptor = { kind: "struct", ownership: "borrowed", isInline: true, size: 8 };
const INT32: Descriptor = { kind: "int32" };

describe.each(["bound", "unbound"] as const)("%s field bounds", (mode) => {
    const access = (descriptor: Descriptor) => {
        const bound = bindField(descriptor);

        return {
            read: (handle: ExternalObject<Handle>, offset: number) => mode === "bound"
                ? readField(bound, handle, offset)
                : read(handle, descriptor, offset),
            write: (handle: ExternalObject<Handle>, offset: number, value: unknown) => mode === "bound"
                ? writeField(bound, handle, offset, value)
                : write(handle, descriptor, offset, value),
        };
    };

    test.each([
        [{ kind: "uint8" }, 1, 255],
        [{ kind: "int16" }, 2, -123],
        [INT32, 4, -456],
        [{ kind: "int64" }, 8, -789],
        [{ kind: "biguint64" }, 8, 123n],
        [{ kind: "float32" }, 4, 0.5],
        [{ kind: "float64" }, 8, Math.PI],
        [{ kind: "int32" }, 4, 1],
        [{ kind: "string", ownership: "borrowed" }, 8, "hello"],
    ] satisfies [Descriptor, number, unknown][])("a %j field fits exactly in %i bytes", (descriptor, size, value) => {
        const field = access(descriptor);
        const block = alloc(size);

        field.write(block, 0, value);

        expect(field.read(block, 0)).toBe(value);
        expect(() => field.read(block, 1)).toThrow();
        expect(() => field.write(block, 1, value)).toThrow();
        expect(field.read(block, 0)).toBe(value);
    });

    test("a bounded inline field rejects reads into its sibling", () => {
        const owner = alloc(64);
        const child = access(INLINE).read(owner, 16) as ExternalObject<Handle>;

        expect(() => access(INT32).read(child, 8)).toThrow();
    });

    test("a bounded inline field rejects writes into its sibling", () => {
        const owner = alloc(64);
        const child = access(INLINE).read(owner, 16) as ExternalObject<Handle>;

        expect(() => access(INT32).write(child, 8, 123)).toThrow();
        expect(read(owner, INT32, 24)).toBe(0);
    });

    test("a nested inline field retains its own extent", () => {
        const owner = alloc(64);
        const outer = access({ ...INLINE, size: 16 }).read(owner, 16) as ExternalObject<Handle>;
        const inner = access(INLINE).read(outer, 4) as ExternalObject<Handle>;
        const number = access(INT32);

        number.write(inner, 4, 77);

        expect(read(owner, INT32, 24)).toBe(77);
        expect(() => number.read(inner, 5)).toThrow();
        expect(() => number.write(inner, 5, 88)).toThrow();
    });

    test("an inline field must fit within its owner's allocation", () => {
        const owner = alloc(16);
        const field = access(INLINE);

        expect(() => field.read(owner, 9)).toThrow();
        expect(() => field.write(owner, 9, alloc(8))).toThrow();
    });

    test("an inline field without a declared size inherits the owner's remaining extent", () => {
        const owner = alloc(16);
        const field = access({ kind: "struct", ownership: "borrowed", isInline: true });
        const child = field.read(owner, 8) as ExternalObject<Handle>;
        const number = access(INT32);

        number.write(child, 4, 42);

        expect(read(owner, INT32, 12)).toBe(42);
        expect(() => number.read(child, 5)).toThrow();
        expect(() => number.write(child, 5, 42)).toThrow();
    });

    test("a field offset beyond the allocation throws", () => {
        const owner = alloc(16);
        const field = access(INT32);

        expect(() => field.read(owner, 2 ** 53)).toThrow();
        expect(() => field.write(owner, 2 ** 53, 1)).toThrow();
    });

    test.each([
        INLINE,
        {
            kind: "boxed",
            typeName: "GDate",
            ownership: "borrowed",
            isInline: true,
            size: 8,
            sharedLibrary: "libgobject-2.0.so.0",
            getTypeFnName: "g_date_get_type",
        },
    ] satisfies Descriptor[])("an inline %j field bounds both sides of a copy", (descriptor) => {
        const field = access(descriptor);
        const source = alloc(8);
        const owner = alloc(16);
        write(source, INT32, 4, 42);

        field.write(owner, 8, source);

        const child = field.read(owner, 8) as ExternalObject<Handle>;
        expect(read(child, INT32, 4)).toBe(42);
        expect(() => field.write(owner, 8, alloc(7))).toThrow();
        expect(read(child, INT32, 4)).toBe(42);
        expect(() => access(INT32).read(child, 5)).toThrow();
        expect(() => field.write(owner, 9, source)).toThrow();
    });
});

test("copying the full extent of an inline field leaves its sibling unchanged", () => {
    const source = alloc(8);
    const owner = alloc(64);
    const child = read(owner, INLINE, 16) as ExternalObject<Handle>;
    write(source, INT32, 4, 42);

    copy(child, source, 8);

    expect(read(owner, INT32, 20)).toBe(42);
    expect(read(owner, INT32, 24)).toBe(0);
});

test("a bounded inline field rejects a copy into its sibling", () => {
    const owner = alloc(64);
    const child = read(owner, INLINE, 16) as ExternalObject<Handle>;

    expect(() => copy(child, alloc(16), 16)).toThrow();
});

test("a bounded inline field rejects a copy from its sibling", () => {
    const owner = alloc(64);
    const child = read(owner, INLINE, 16) as ExternalObject<Handle>;

    expect(() => copy(alloc(16), child, 16)).toThrow();
});

test("copying into a struct pointer field rejects an undersized source", () => {
    const owner = alloc(8);
    const target = alloc(8);
    const source = alloc(8);
    const descriptor: Descriptor = { kind: "struct", ownership: "borrowed", size: 8 };
    write(owner, { kind: "struct", ownership: "borrowed" }, 0, target);
    write(source, INT32, 4, 42);

    write(owner, descriptor, 0, source);

    expect(read(target, INT32, 4)).toBe(42);
    expect(() => write(owner, descriptor, 0, alloc(7))).toThrow();
    expect(read(target, INT32, 4)).toBe(42);
});
