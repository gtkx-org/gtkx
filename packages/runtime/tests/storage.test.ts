import { alloc, getHandle, read, setHandle, t, write } from "@gtkx/runtime";
import { expect, test } from "vitest";

test("fixed and strided fields share the same bounded native storage", () => {
    const storage = alloc(12);
    const field = t.field(t.int32, 4);
    const strided = t.fieldAt(t.int32);

    field.write(storage, 42);
    expect(strided.read(storage, 4)).toBe(42);
    strided.write(storage, 8, -7);
    expect(read(storage, t.int32, 8)).toBe(-7);
    write(storage, t.int32, 4, 19);
    expect(field.read(storage)).toBe(19);
    expect(() => strided.write(storage, 9, 99)).toThrow();
    expect(strided.read(storage, 8)).toBe(-7);
});

test("string fields preserve Unicode, replacement, null and failed writes", () => {
    const storage = alloc(8);
    const field = t.field(t.string(), 0);

    expect(field.read(storage)).toBeNull();
    field.write(storage, "\u{FEFF}café");
    expect(field.read(storage)).toBe("\u{FEFF}café");
    expect(() => field.write(storage, "a\0b")).toThrow();
    expect(field.read(storage)).toBe("\u{FEFF}café");
    field.write(storage, "");
    expect(field.read(storage)).toBe("");
    field.write(storage, null);
    expect(field.read(storage)).toBeNull();
});

test("wrappers retain their assigned handle across field operations", () => {
    const wrapper = {};
    const storage = alloc(4);
    setHandle(wrapper, storage);
    write(getHandle(wrapper), t.int32, 0, 17);

    expect(getHandle(wrapper)).toBe(storage);
    expect(read(storage, t.int32, 0)).toBe(17);
    expect(() => getHandle({})).toThrow();
});
