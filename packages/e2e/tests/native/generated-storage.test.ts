import * as GLib from "@gtkx/gi/glib";
import * as GObject from "@gtkx/gi/gobject";
import {
    alloc, bindField, copy, type Descriptor, type ExternalObject, type Handle, read, readField, write, writeField,
} from "@gtkx/native";
import { getHandle, wrapHandle } from "@gtkx/runtime";
import { describe, expect, test } from "vitest";

test.each(["hello", "", "café"])("generated string fields reflect native storage for %j", (text) => {
    const value = GLib.String.new(text);

    expect(value.str).toBe(text);
    expect(value.len).toBe(new TextEncoder().encode(text).length);
});

test("generated GValue allocation holds a typed payload", () => {
    const value = new GObject.Value();
    const type = GObject.typeFromName("gint");
    value.init(type);
    value.setInt(42);

    expect(value.getInt()).toBe(42);
    expect(GObject.typeCheckValueHolds(value, type)).toBe(true);
    expect(read(getHandle(value), { kind: "biguint64" }, 0)).toBe(type);
});

test("a registered non-boxed GType cannot allocate boxed storage", () => {
    expect(() => alloc(16, GObject.typeFromName("GObject"))).toThrow();
});

test("copying boxed allocation storage preserves the generated value API", () => {
    const source = new GObject.Value();
    const destination = new GObject.Value();
    source.init(GObject.typeFromName("gint"));
    source.setInt(99);

    copy(getHandle(destination), getHandle(source), 24);
    source.setInt(7);

    expect(destination.getInt()).toBe(99);
    expect(source.getInt()).toBe(7);
});

describe.each(["bound", "unbound"] as const)("%s boxed field bounds", (mode) => {
    test("an inline date field bounds both sides of a copy", () => {
        const date = GLib.Date.newDmy(29, GLib.DateMonth.DECEMBER, 2026);
        GObject.typeEnsure(GLib.Date);
        const descriptor: Descriptor = {
            kind: "boxed", typeName: "GDate", ownership: "borrowed", isInline: true, size: 8,
        };
        const field = bindField(descriptor);
        const readDate = (handle: ExternalObject<Handle>, offset: number): ExternalObject<Handle> => {
            const value = mode === "bound" ? readField(field, handle, offset) : read(handle, descriptor, offset);

            return value as ExternalObject<Handle>;
        };
        const writeDate = (handle: ExternalObject<Handle>, offset: number, value: ExternalObject<Handle>): void => {
            if (mode === "bound") {
                writeField(field, handle, offset, value);
            } else {
                write(handle, descriptor, offset, value);
            }
        };
        const owner = alloc(16);

        writeDate(owner, 8, getHandle(date));
        const child = readDate(owner, 8);
        const copied = wrapHandle(child, GLib.Date);
        expect(copied.getDay()).toBe(29);
        expect(copied.getYear()).toBe(2026);
        expect(() => {
            writeDate(owner, 8, alloc(7));
        }).toThrow();
        expect(copied.getDay()).toBe(29);
        expect(() => read(child, { kind: "int32" }, 5)).toThrow();
        expect(() => {
            writeDate(owner, 9, getHandle(date));
        }).toThrow();
    });
});
