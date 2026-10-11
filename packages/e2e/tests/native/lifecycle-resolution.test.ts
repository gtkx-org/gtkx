import { openLibrary, resolveSymbol } from "@gtkx/native";
import { type Descriptor, t, TYPE_INVALID, typeFromName } from "@gtkx/runtime";
import { expect, test } from "vitest";

const glib = "libglib-2.0.so.0";
const gobject = "libgobject-2.0.so.0";
const date = t.struct("full", { sharedLibrary: glib, freeFnName: "g_date_free" });
const newDate = t.bind(glib, "g_date_new_dmy", [t.uint8, t.int32, t.uint16], date);
const getDay = t.bind(glib, "g_date_get_day", [t.struct()], t.uint8);
const addDays = t.bind(glib, "g_date_add_days", [t.struct(), t.uint32], t.void);
const registerBoxed = t.bind(gobject, "g_boxed_type_register_static", [t.string(), t.buffer, t.buffer], t.biguint64);
const variant = t.fundamental(glib, "g_variant_ref", "g_variant_unref");
const newVariant = t.bind(glib, "g_variant_new_int32", [t.int32], { ...variant, ownership: "full" });
const getInt32 = t.bind(glib, "g_variant_get_int32", [variant], t.int32);

let typeCount = 0;

const uniqueTypeName = (): string => `GtkxLifecycleDate${String(process.pid)}N${String(typeCount++)}`;

const registerDateType = (name: string): unknown => {
    const library = openLibrary(glib);
    const copy = resolveSymbol(library, "g_date_copy", false);
    const free = resolveSymbol(library, "g_date_free", false);

    return registerBoxed(name, copy, free);
};

const listItem = (descriptor: Descriptor): ReturnType<typeof t.bind> =>
    t.bind(glib, "g_list_nth_data", [t.list(t.struct()), t.uint32], descriptor);

test("boxed bindings can be compiled before their type is registered", () => {
    const name = uniqueTypeName();
    const create = t.bind(glib, "g_date_new_dmy", [t.uint8, t.int32, t.uint16], t.boxed(name, { ownership: "full" }));
    const read = listItem(t.boxed(name));

    expect(typeFromName(name)).toBe(TYPE_INVALID);
    expect(registerDateType(name)).toBe(typeFromName(name));

    const source = create(17, 1, 2000);
    const copied = read([source], 0);
    addDays(source, 2);

    expect(getDay(source)).toBe(19);
    expect(getDay(copied)).toBe(17);
});

test("an unregistered boxed name is retried after a failed decode", () => {
    const name = uniqueTypeName();
    const read = listItem(t.boxed(name));
    const source = newDate(23, 2, 2000);

    expect(() => read([source], 0)).toThrow(/no type available/);
    registerDateType(name);

    const copied = read([source], 0);
    addDays(source, 1);

    expect(getDay(copied)).toBe(23);
    expect(getDay(source)).toBe(24);
});

test("a type registered during a callback is available to the enclosing list decode", () => {
    const name = uniqueTypeName();
    const copyList = t.bind(
        glib,
        "g_list_copy_deep",
        [
            t.list(t.struct()),
            t.callback([t.buffer, t.buffer], t.buffer, { hasUserData: true, userDataIndex: 1, scope: "call" }),
        ],
        t.list(t.boxed(name), "full"),
    );
    const source = newDate(11, 3, 2000);
    expect(typeFromName(name)).toBe(TYPE_INVALID);

    const copied = copyList([source], (pointer: bigint) => {
        registerDateType(name);
        return pointer;
    }) as unknown[];
    addDays(source, 1);

    expect(copied).toHaveLength(1);
    expect(typeFromName(name)).not.toBe(TYPE_INVALID);
    expect(getDay(copied[0])).toBe(11);
    expect(getDay(source)).toBe(12);
});

test("a late registered input type enforces boxed compatibility after an earlier miss", () => {
    const name = uniqueTypeName();
    const readDay = t.bind(glib, "g_date_get_day", [t.boxed(name)], t.uint8);
    const create = t.bind(
        glib,
        "g_date_new_dmy",
        [t.uint8, t.int32, t.uint16],
        t.boxed("GDate", { ownership: "full", sharedLibrary: gobject, getTypeFnName: "g_date_get_type" }),
    );
    const source = create(29, 4, 2000);

    expect(readDay(source)).toBe(29);
    registerDateType(name);

    expect(() => readDay(source)).toThrow(/Expected a boxed value of type.*got GDate/);
    expect(getDay(source)).toBe(29);
});

test("a missing boxed type getter is resolved only for a non-null value", () => {
    const read = listItem(
        t.boxed(uniqueTypeName(), { sharedLibrary: gobject, getTypeFnName: "gtkx_missing_date_get_type" }),
    );
    const source = newDate(7, 5, 2000);

    expect(read([], 0)).toBeNull();
    expect(() => read([source], 0)).toThrow(/gtkx_missing_date_get_type/);
    expect(() => read([source], 0)).toThrow(/gtkx_missing_date_get_type/);
    expect(getDay(source)).toBe(7);
});

test.each([
    { copyFnName: "gtkx_missing_date_copy", freeFnName: "g_date_free", missing: "gtkx_missing_date_copy" },
    { copyFnName: "g_date_copy", freeFnName: "gtkx_missing_date_free", missing: "gtkx_missing_date_free" },
])("a missing struct lifecycle operation $missing is resolved only on non-null use", (options) => {
    const read = listItem(t.struct("borrowed", { sharedLibrary: glib, ...options }));
    const source = newDate(13, 6, 2000);

    expect(read([], 0)).toBeNull();
    expect(() => read([source], 0)).toThrow(options.missing);
    expect(getDay(source)).toBe(13);
});

test.each([
    { ref: "gtkx_missing_variant_ref", unref: "g_variant_unref", missing: "gtkx_missing_variant_ref" },
    { ref: "g_variant_ref", unref: "gtkx_missing_variant_unref", missing: "gtkx_missing_variant_unref" },
])("a missing fundamental operation $missing is resolved only on non-null use", ({ ref, unref, missing }) => {
    const read = listItem(t.fundamental(glib, ref, unref));
    const source = newVariant(37);

    expect(read([], 0)).toBeNull();
    expect(() => read([source], 0)).toThrow(missing);
    expect(getInt32(source)).toBe(37);
});

test("fundamental decoding rejects an unref function without its matching acquisition", () => {
    const read = listItem(t.fundamental(glib, "", "g_variant_unref"));
    const source = newVariant(41);

    expect(read([], 0)).toBeNull();
    expect(() => read([source], 0)).toThrow(/without a ref function/);
    expect(getInt32(source)).toBe(41);
});

test("lazy fundamental lifecycle resolution rejects a different release function", () => {
    const hash = t.bind(glib, "g_direct_hash", [t.fundamental(glib, "g_bytes_ref", "g_bytes_unref")], t.uint32);
    const source = newVariant(43);

    expect(hash(null)).toBe(0);
    expect(() => hash(source)).toThrow(/released by a different function/);
    expect(getInt32(source)).toBe(43);
});

test("owned values survive collection of their constructor bindings", async () => {
    const gc = globalThis.gc;
    if (gc === undefined) {
        throw new Error("Lifecycle resolution tests require --expose-gc");
    }
    const createOwned = (): { value: unknown; constructor: WeakRef<ReturnType<typeof t.bind>> } => {
        const create = t.bind(glib, "g_variant_new_int32", [t.int32], { ...variant, ownership: "full" });
        return { value: create(73), constructor: new WeakRef(create) };
    };
    const held = createOwned();
    for (let attempt = 0; attempt < 30 && held.constructor.deref() !== undefined; attempt++) {
        await new Promise<void>((resolve) => setImmediate(resolve));
        gc();
    }

    expect(held.constructor.deref()).toBeUndefined();
    expect(getInt32(held.value)).toBe(73);
});
