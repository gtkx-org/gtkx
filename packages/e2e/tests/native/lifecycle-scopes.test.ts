import * as GObject from "@gtkx/gi/gobject";
import {
    alloc,
    compileDescriptor,
    type Descriptor,
    type ExternalObject,
    type Handle,
    openLibrary,
    readField,
    resolveSymbol,
    setValuePointer,
    writeField,
} from "@gtkx/native";
import { getHandle, read, t, write } from "@gtkx/runtime";
import { expect, test } from "vitest";

const glib = "libglib-2.0.so.0";
const variant = t.fundamental(glib, "g_variant_ref", "g_variant_unref");
const newVariant = t.bind(glib, "g_variant_new_int32", [t.int32], { ...variant, ownership: "full" });
const getInt32 = t.bind(glib, "g_variant_get_int32", [variant], t.int32);
const compare = t.callback([t.struct(), t.struct()], t.int32, { scope: "call" });
const sort = t.bind("libc.so.6", "qsort", [t.struct(), t.biguint64, t.biguint64, compare], t.void);

const resolveOperation = (name: string): ExternalObject<Handle> => {
    const handle = resolveSymbol(openLibrary(glib), name, false);
    if (handle == null) {
        throw new Error(`Missing GLib operation ${name}`);
    }
    return handle;
};

test.each(["read", "write", "pointer"])(
    "a caught lifecycle failure during %s leaves its enclosing native callback usable",
    (operation) => {
        const failure = new Error(`lifecycle ${operation} failure`);
        let failing = true;
        const descriptor: Descriptor = {
            kind: "fundamental",
            ownership: "borrowed",
            isCallerAllocated: false,
            isInline: false,
            isValueSafe: false,
            refResolver: () => {
                if (failing) {
                    throw failure;
                }
                return resolveOperation("g_variant_ref");
            },
            unrefResolver: () => resolveOperation("g_variant_unref"),
            unrefLabel: "g_variant_unref",
        };
        const field = compileDescriptor(descriptor);
        const source = newVariant(42);
        const value = new GObject.Value();
        value.init(GObject.typeFromName("gpointer"));
        const slot = alloc(8);
        writeField(compileDescriptor({ kind: "buffer" }), slot, 0, source);
        const invoke = (): unknown => {
            switch (operation) {
                case "read":
                    return readField(field, slot, 0);
                case "write":
                    return writeField(field, slot, 0, source);
                default:
                    setValuePointer(getHandle(value), field, source);
                    return source;
            }
        };
        const values = alloc(8);
        write(values, t.int32, 0, 9);
        write(values, t.int32, 4, -2);
        const caught: unknown[] = [];

        sort(values, 2n, 4n, (left: ExternalObject<Handle>, right: ExternalObject<Handle>) => {
            try {
                invoke();
            } catch (error) {
                caught.push(error);
            }
            return (read(left, t.int32, 0) as number) - (read(right, t.int32, 0) as number);
        });

        expect(caught.length).toBeGreaterThan(0);
        expect(caught.every((error) => error === failure)).toBe(true);
        expect([read(values, t.int32, 0), read(values, t.int32, 4)]).toEqual([-2, 9]);

        failing = false;
        const result = invoke();
        expect(getInt32(operation === "write" ? source : result)).toBe(42);
    },
);
