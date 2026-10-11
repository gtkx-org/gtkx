import {
    attachCall,
    call,
    compileCall,
    compileVfuncSlot,
    type Descriptor,
    type ExternalObject,
    getType,
    getTypeClass,
    type Handle,
    openLibrary,
    readFunctionPointer,
    readVfuncSlot,
    resolveSymbol,
} from "@gtkx/native";
import { resolveType, t, typeFromName } from "@gtkx/runtime";
import { expect, test } from "vitest";

const gobject = "libgobject-2.0.so.0";
const gio = "libgio-2.0.so.0";
const objectType = resolveType(gobject, "g_object_get_type");
const listModelType = resolveType(gio, "g_list_model_get_type");
const listStoreType = resolveType(gio, "g_list_store_get_type");
const listModelSlot = {
    interfaceType: listModelType,
    byteOffset: 24,
    vtableSize: 40,
    label: "GListModel.get_n_items",
};
const objectArgument: Descriptor = { kind: "object", ownership: "borrowed", isCallScoped: false };
const objectReturn: Descriptor = { kind: "object", ownership: "full", isCallScoped: false };
const newStore = t.bind(gio, "g_list_store_new", [t.biguint64], t.object("full"));
const append = t.bind(gio, "g_list_store_append", [t.object(), t.object()], t.void);

const symbol = (name: string): ExternalObject<Handle> => {
    const handle = resolveSymbol(openLibrary("libc.so.6"), name, false);
    if (handle == null) {
        throw new Error(`Missing libc symbol ${name}`);
    }
    return handle;
};

const collect = async (references: WeakRef<object>[]): Promise<void> => {
    const gc = globalThis.gc;
    if (gc === undefined) {
        throw new Error("Vtable ownership tests require --expose-gc");
    }
    for (let round = 0; round < 30 && references.some((reference) => reference.deref() !== undefined); round++) {
        await new Promise<void>((resolve) => setImmediate(resolve));
        gc();
    }
    expect(references.every((reference) => reference.deref() === undefined)).toBe(true);
};

test("a compiled signature can attach independent executable targets", () => {
    const signature = compileCall([{ kind: "int32" }], { kind: "int32" }, "integer transform", { argOrder: [0] });
    const absolute = attachCall(signature, symbol("abs"));
    const upper = attachCall(signature, symbol("toupper"));

    expect(call(absolute, [-97]).value).toBe(97);
    expect(call(upper, [97]).value).toBe(65);
    expect(call(absolute, [-5]).value).toBe(5);
    expect(() => call(upper, [])).toThrow("expected 1 arguments");
});

test("an attached target retains its compiled signature and executable after their handles are collected", async () => {
    const { descriptor, references } = (() => {
        const signature = compileCall([{ kind: "int32" }], { kind: "int32" }, "abs", { argOrder: [0] });
        const target = symbol("abs");
        return {
            descriptor: attachCall(signature, target),
            references: [new WeakRef(signature), new WeakRef(target)],
        };
    })();

    await collect(references);
    expect(call(descriptor, [-42]).value).toBe(42);
});

test("class and interface slot compilation rejects incompatible type kinds", () => {
    expect(() => compileVfuncSlot({ ...listModelSlot, interfaceType: objectType })).toThrow("not an interface");
    expect(() => compileVfuncSlot({ ...listModelSlot, instanceType: typeFromName("guint") })).toThrow("not classed");
    expect(() => compileVfuncSlot({ byteOffset: 0, label: "absent owner" })).toThrow("neither an instance type");
});

test("class slots reject unaligned and out-of-bounds offsets before a target is read", () => {
    expect(() => compileVfuncSlot({ instanceType: objectType, byteOffset: 1, label: "unaligned class" })).toThrow(
        "not aligned",
    );
    expect(() =>
        compileVfuncSlot({ instanceType: objectType, byteOffset: 1_048_576, label: "out-of-bounds class" }),
    ).toThrow("exceeds class size");
});

test("interface slots require bounded aligned metadata before a target is read", () => {
    expect(() =>
        compileVfuncSlot({
            interfaceType: listModelType,
            byteOffset: listModelSlot.byteOffset,
            label: listModelSlot.label,
        }),
    ).toThrow("without a vtable size");
    expect(() => compileVfuncSlot({ ...listModelSlot, byteOffset: 25 })).toThrow("not aligned");
    expect(() => compileVfuncSlot({ ...listModelSlot, byteOffset: 40 })).toThrow("exceeds class size");
});

test("unimplemented interfaces and empty default slots fail only when read", () => {
    const missingInterface = compileVfuncSlot({ ...listModelSlot, instanceType: objectType });
    const emptyDefault = compileVfuncSlot(listModelSlot);

    expect(() => readVfuncSlot(missingInterface)).toThrow("does not implement interface");
    expect(() => readVfuncSlot(emptyDefault)).toThrow("provides no implementation");
    expect(() => readVfuncSlot(missingInterface)).toThrow("does not implement interface");
});

test("an interface target retains its owning class across handle collection", async () => {
    const { descriptor, references } = (() => {
        const slot = compileVfuncSlot({ ...listModelSlot, instanceType: listStoreType });
        const target = readVfuncSlot(slot);
        const signature = compileCall([objectArgument], { kind: "uint32" }, listModelSlot.label, { argOrder: [0] });
        return {
            descriptor: attachCall(signature, target),
            references: [new WeakRef(slot), new WeakRef(target), new WeakRef(signature)],
        };
    })();
    const store = newStore(objectType) as ExternalObject<Handle>;
    const item = newStore(objectType);

    await collect(references);
    expect(call(descriptor, [store]).value).toBe(0);
    append(store, item);
    expect(call(descriptor, [store]).value).toBe(1);
});

test("a class function read retains the class owner after its external handle is collected", async () => {
    const { descriptor, references } = (() => {
        const owner = getTypeClass(objectType);
        const target = readFunctionPointer(owner, 16);
        const signature = compileCall(
            [{ kind: "biguint64", isDirectWord: false }, { kind: "uint32" }, { kind: "buffer" }],
            objectReturn,
            "GObject.constructor",
            { argOrder: [0, 1, 2] },
        );
        return {
            descriptor: attachCall(signature, target),
            references: [new WeakRef(owner), new WeakRef(target), new WeakRef(signature)],
        };
    })();

    await collect(references);
    const instance = call(descriptor, [objectType, 0, null]).value as ExternalObject<Handle>;
    expect(getType(instance)).toBe(objectType);
});
