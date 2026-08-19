import * as Gio from "@gtkx/gi/gio";
import { TYPE_STRING, Value } from "@gtkx/gi/gobject";
import { resolveType } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";

const GOBJECT_LIB = "libgobject-2.0.so.0,libglib-2.0.so.0";
const byteArrayType = resolveType(GOBJECT_LIB, "g_byte_array_get_type");
const valueGType = resolveType(GOBJECT_LIB, "g_value_get_type");

const valueOfType = (gtype: bigint): Value => {
    const value = new Value();
    value.init(gtype);

    return value;
};

describe("a GValue holding a GByteArray", () => {
    it("round-trips a Uint8Array through setBoxed and getBoxed", () => {
        const value = valueOfType(byteArrayType);
        value.setBoxed(new Uint8Array([1, 2, 3]));
        expect(value.getBoxed()).toEqual(new Uint8Array([1, 2, 3]));
    });

    it("reads a GByteArray property as a Uint8Array", () => {
        const path = "/gtkx-tests/bytes.sock";
        const address = new Gio.UnixSocketAddress({ path });
        expect(address.pathAsArray).toEqual(new TextEncoder().encode(path));
    });

    it("constructs an object from a Uint8Array construct property", () => {
        const path = "/gtkx-tests/bytes-in.sock";
        const address = new Gio.UnixSocketAddress({ pathAsArray: new TextEncoder().encode(path) });
        expect(address.path).toBe(path);
    });

    it("hands back an empty Uint8Array for an empty byte array", () => {
        const value = valueOfType(byteArrayType);
        value.setBoxed(new Uint8Array(0));
        expect(value.getBoxed()).toEqual(new Uint8Array(0));
    });

    it("stores a plain array of byte values", () => {
        const value = valueOfType(byteArrayType);
        value.setBoxed([4, 5, 255]);
        expect(value.getBoxed()).toEqual(new Uint8Array([4, 5, 255]));
    });

    it("hands back null when the value holds no byte array", () => {
        const value = valueOfType(byteArrayType);
        value.setBoxed(null);
        expect(value.getBoxed()).toBeNull();
    });

    it("throws when a byte is out of range", () => {
        const value = valueOfType(byteArrayType);

        expect(() => {
            value.setBoxed([256]);
        }).toThrow();
    });

    it("throws when a string is stored as a byte array", () => {
        const value = valueOfType(byteArrayType);

        expect(() => {
            value.setBoxed("bytes");
        }).toThrow();
    });
});

describe("a GValue holding a nested GValue", () => {
    it("boxes a plain string into a nested value", () => {
        const value = valueOfType(valueGType);
        value.setBoxed("hello");
        expect(value.getBoxed<Value>().getString()).toBe("hello");
    });

    it("boxes an integer into a nested value", () => {
        const value = valueOfType(valueGType);
        value.setBoxed(42);
        expect(value.getBoxed<Value>().getInt()).toBe(42);
    });

    it("copies an already-built value instead of nesting twice", () => {
        const inner = new Value();
        inner.init(TYPE_STRING);
        inner.setString("built");
        const outer = valueOfType(valueGType);
        outer.setBoxed(inner);
        inner.setString("changed");
        expect(outer.getBoxed<Value>().getString()).toBe("built");
    });

    it("infers a double for a fractional number", () => {
        const value = valueOfType(valueGType);
        value.setBoxed(1.5);
        expect(value.getBoxed<Value>().getDouble()).toBe(1.5);
    });

    it("boxes a boolean and a bigint", () => {
        const flag = valueOfType(valueGType);
        flag.setBoxed(true);
        expect(flag.getBoxed<Value>().getBoolean()).toBe(true);
        const wide = valueOfType(valueGType);
        wide.setBoxed(5n);
        expect(wide.getBoxed<Value>().getInt64()).toBe(5n);
    });

    it("hands back null when no nested value is stored", () => {
        const value = valueOfType(valueGType);
        value.setBoxed(null);
        expect(value.getBoxed()).toBeNull();
    });

    it("throws for a bigint outside the 64-bit range", () => {
        const value = valueOfType(valueGType);

        expect(() => {
            value.setBoxed(2n ** 65n);
        }).toThrow();
    });
});
