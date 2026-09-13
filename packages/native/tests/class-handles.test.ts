import { alloc, bind, call, copy, type ExternalObject, getTypeClass, type Handle, read, registerClass, resolveType,
    write } from "@gtkx/native";
import { expect, test } from "vitest";

const encoder = new TextEncoder();

const GOBJECT = "libgobject-2.0.so.0";
const objectType = resolveType(GOBJECT, "g_object_get_type");
const typeQuery = bind(GOBJECT, "g_type_query", [
    { kind: "biguint64" },
    { kind: "struct", ownership: "borrowed" },
], { kind: "void" });
const typeFromName = bind(GOBJECT, "g_type_from_name", [{ kind: "bytes", ownership: "borrowed" }], {
    kind: "biguint64",
});

const query = alloc(24);
call(typeQuery, [objectType, query]);
const classSize = read(query, { kind: "uint32" }, 16) as number;
const registrations = { count: 0 };

function initializedClass(): { handle: ExternalObject<Handle>; gtype: bigint } {
    let handle: ExternalObject<Handle> | undefined;
    const gtype = registerClass(`GtkxNativeClassHandle${String(registrations.count++)}`, objectType, {
        initialize: (value) => {
            handle = value;
        },
    });
    if (handle === undefined) {
        throw new Error("Class initialization did not run");
    }

    return { handle, gtype };
}

const sources = [
    { name: "type lookup", create: () => ({ handle: getTypeClass(objectType), gtype: objectType }) },
    { name: "class initialization", create: initializedClass },
];

test.each(sources)("$name retains readable class memory", ({ create }) => {
    const { handle, gtype } = create();

    expect(read(handle, { kind: "biguint64" }, 0)).toBe(gtype);
    expect(typeof read(handle, { kind: "uint8" }, classSize - 1)).toBe("number");
});

test.each(sources)("$name rejects access beyond the class allocation", ({ create }) => {
    const { handle } = create();

    expect(() => read(handle, { kind: "uint8" }, classSize)).toThrow();
    expect(() => read(handle, { kind: "biguint64" }, classSize - 1)).toThrow();
    expect(() => write(handle, { kind: "uint8" }, classSize, 0)).toThrow();
    expect(() => copy(alloc(classSize + 1), handle, classSize + 1)).toThrow();
});

test("class registration rejects a classed parent outside GObject", () => {
    const paramType = call(typeFromName, [encoder.encode("GParam")]).value as bigint;

    expect(() => registerClass("GtkxNativeInvalidParamSubclass", paramType)).toThrow();
});
