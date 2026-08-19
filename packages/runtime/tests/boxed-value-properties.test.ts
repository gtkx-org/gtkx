import type { ParamSpec } from "@gtkx/gi/gobject";
import { Object as GObject, ParamFlags, paramSpecBoxed, TYPE_STRING, Value } from "@gtkx/gi/gobject";
import { registerClass, resolveType } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";
import { watchNotify } from "./helpers/gobject.js";
import { createTypeNameFactory } from "./helpers/unique-name.js";

const uniqueName = createTypeNameFactory("_");
const GOBJECT_LIB = "libgobject-2.0.so.0,libglib-2.0.so.0";
const byteArrayType = resolveType(GOBJECT_LIB, "g_byte_array_get_type");
const valueGType = resolveType(GOBJECT_LIB, "g_value_get_type");

const holderProperties = (): Record<string, ParamSpec> => ({
    payload: paramSpecBoxed("payload", null, null, byteArrayType, ParamFlags.READWRITE),
    content: paramSpecBoxed("content", null, null, valueGType, ParamFlags.READWRITE),
});

const makeHolderClass = () => {
    class Holder extends GObject {
        declare payload: Uint8Array | number[] | null;

        declare content: unknown;
    }

    registerClass(Holder, { typeName: uniqueName("GtkxBoxedValueProp"), properties: holderProperties() });

    return Holder;
};

const readProperty = (instance: GObject, name: string, gtype: bigint): unknown => {
    const value = new Value();
    value.init(gtype);
    instance.getProperty(name, value);

    return value.getBoxed();
};

describe("a registered GByteArray property", () => {
    it("takes a Uint8Array and serves it back through GObject", () => {
        const holder = new (makeHolderClass())();
        holder.payload = new Uint8Array([7, 8]);
        expect(holder.payload).toEqual(new Uint8Array([7, 8]));
        expect(readProperty(holder, "payload", byteArrayType)).toEqual(new Uint8Array([7, 8]));
    });

    it("takes a Uint8Array at construction and notifies on change", () => {
        const holder = new (makeHolderClass())({ payload: new Uint8Array([1]) });
        expect(holder.payload).toEqual(new Uint8Array([1]));
        const seen = watchNotify(holder);
        holder.payload = new Uint8Array([2]);
        expect(seen).toEqual(["payload"]);
    });

    it("defaults to null and takes an array of byte values", () => {
        const holder = new (makeHolderClass())();
        expect(holder.payload).toBeNull();
        holder.payload = [3, 4];
        expect(readProperty(holder, "payload", byteArrayType)).toEqual(new Uint8Array([3, 4]));
    });

    it("takes a boxed byte array through setProperty", () => {
        const holder = new (makeHolderClass())();
        const value = new Value();
        value.init(byteArrayType);
        value.setBoxed(new Uint8Array([9]));
        holder.setProperty("payload", value);
        expect(holder.payload).toEqual(new Uint8Array([9]));
    });

    it("refuses a value that is not a byte array", () => {
        const holder = new (makeHolderClass())();

        expect(() => {
            Reflect.set(holder, "payload", "text");
        }).toThrow();
    });
});

describe("a registered GObject.Value property", () => {
    it("boxes a plain string and serves it back as a nested value", () => {
        const holder = new (makeHolderClass())();
        holder.content = "hello";
        expect(holder.content).toBe("hello");
        expect((readProperty(holder, "content", valueGType) as Value).getString()).toBe("hello");
    });

    it("boxes a plain number given at construction", () => {
        const holder = new (makeHolderClass())({ content: 42 });
        expect((readProperty(holder, "content", valueGType) as Value).getInt()).toBe(42);
    });

    it("takes an already-built value and hands its copy back", () => {
        const holder = new (makeHolderClass())();
        const built = new Value();
        built.init(TYPE_STRING);
        built.setString("built");
        holder.content = built;
        expect((readProperty(holder, "content", valueGType) as Value).getString()).toBe("built");
    });

    it("refuses a value no GType can be inferred from", () => {
        const holder = new (makeHolderClass())();

        expect(() => {
            holder.content = () => null;
        }).toThrow();
    });
});
