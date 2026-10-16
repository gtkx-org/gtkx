import {
    compileDescriptor,
    call,
    bindFunction,
    type Descriptor,
    type ExternalObject,
    getType,
    type Handle,
    openLibrary,
    readField,
    getTypeClass,
    type DecodedCallback,
    type FunctionSignature,
    registerClass,
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
const itemCount = t.bind(gio, "g_list_model_get_n_items", [t.object()], t.uint32);
const newInstance = t.bind(
    gobject,
    "g_object_new_with_properties",
    [t.biguint64, t.uint32, t.buffer, t.buffer],
    t.object("full"),
);
let nextType = 0;
const uniqueTypeName = (): string => `GtkxSharedVfunc${String(process.pid)}_${String(nextType++)}`;

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

test("a compiled signature can call independent executable targets", () => {
    const signature = bindFunction(
        [compileDescriptor({ kind: "int32" })],
        compileDescriptor({ kind: "int32" }),
        "integer transform",
        { argOrder: [0] },
    );
    const absolute = symbol("abs");
    const upper = symbol("toupper");

    expect(call(signature, absolute, [-97]).value).toBe(97);
    expect(call(signature, upper, [97]).value).toBe(65);
    expect(call(signature, absolute, [-5]).value).toBe(5);
    expect(() => call(signature, upper, [])).toThrow("expected 1 arguments");
});

test("an executable target retains its library after the library handle is collected", async () => {
    const signature = bindFunction(
        [compileDescriptor({ kind: "int32" })],
        compileDescriptor({ kind: "int32" }),
        "abs",
        { argOrder: [0] },
    );
    const { target, references } = (() => {
        const library = openLibrary("libc.so.6");
        const target = resolveSymbol(library, "abs", false);
        if (target == null) throw new Error("Missing libc symbol abs");
        return {
            target,
            references: [new WeakRef(library)],
        };
    })();

    await collect(references);
    expect(call(signature, target, [-42]).value).toBe(42);
});

const callbackField = (signature: ExternalObject<FunctionSignature>): Descriptor => ({
    kind: "callback",
    signature,
    scope: "call",
    hasUserData: false,
    hasDestroy: false,
    destroyKind: "destroyNotify",
    releaseWithCompletion: false,
});

const readFunction = (signature: ExternalObject<FunctionSignature>, owner: ExternalObject<Handle>, offset: number) => {
    const callback = readField(compileDescriptor(callbackField(signature)), owner, offset) as DecodedCallback | null;
    if (callback === null) throw new Error("The vtable has no implementation");
    return callback.function;
};

const countSignature = () =>
    bindFunction([compileDescriptor(objectArgument)], compileDescriptor({ kind: "uint32" }), listModelSlot.label, {
        argOrder: [0],
    });

const constantCount =
    (count: number): (() => number) =>
    () =>
        count;

test("registered interfaces share a signature and retain it after its JavaScript handle is collected", async () => {
    const { types, references } = (() => {
        const argument = compileDescriptor(objectArgument);
        const returns = compileDescriptor({ kind: "uint32" });
        const signature = bindFunction([argument], returns, listModelSlot.label, { argOrder: [0] });
        const types = [17, 29].map((count) =>
            registerClass(uniqueTypeName(), objectType, {
                flags: 0,
                vfuncs: [],
                interfaces: [
                    {
                        type: listModelType,
                        vtableSize: listModelSlot.vtableSize,
                        vfuncs: [{ byteOffset: listModelSlot.byteOffset, signature, fn: constantCount(count) }],
                    },
                ],
            }),
        );

        return { types, references: [new WeakRef(signature), new WeakRef(argument), new WeakRef(returns)] };
    })();

    await collect(references);
    expect(types.map((type) => itemCount(newInstance(type, 0, null, null)))).toEqual([17, 29]);
});

const invalidSignatures = [
    {
        name: "hidden user-data",
        create: () =>
            bindFunction(
                [compileDescriptor(objectArgument)],
                compileDescriptor({ kind: "uint32" }),
                "userdata",
                {
                    argOrder: [0],
                },
                { userDataIndex: 0 },
            ),
        message: /hidden user-data/,
    },
    {
        name: "variadic",
        create: () =>
            bindFunction([compileDescriptor(objectArgument)], compileDescriptor({ kind: "uint32" }), "variadic", {
                argOrder: [0],
                fixedArgCount: 1,
            }),
        message: /variadic/,
    },
];

for (const target of ["class", "interface"]) {
    test.each(invalidSignatures)(
        `a ${target} vfunc rejects a $name signature before registering its type`,
        ({ create, message }) => {
            const name = uniqueTypeName();
            const vfunc = { byteOffset: listModelSlot.byteOffset, signature: create(), fn: () => 0 };

            expect(() =>
                registerClass(name, objectType, {
                    flags: 0,
                    vfuncs: target === "class" ? [vfunc] : [],
                    interfaces:
                        target === "interface"
                            ? [{ type: listModelType, vtableSize: listModelSlot.vtableSize, vfuncs: [vfunc] }]
                            : [],
                }),
            ).toThrow(message);
            expect(typeFromName(name)).toBe(0n);
            const type = registerClass(name, objectType, { flags: 0, vfuncs: [], interfaces: [] });
            expect(getType(newInstance(type, 0, null, null) as ExternalObject<Handle>)).toBe(type);
        },
    );
}

test("class and interface vtables reject incompatible type kinds", () => {
    expect(() => getTypeClass(objectType, { interfaceType: objectType, vtableSize: 40 })).toThrow("not an interface");
    expect(() => getTypeClass(typeFromName("guint"))).toThrow("not classed");
});

test("class fields reject reads beyond the owning class size", () => {
    const owner = getTypeClass(objectType);
    expect(() => readFunction(countSignature(), owner, 1_048_576)).toThrow();
});

test.each(["GEnum", "GFlags"])("%s class fields preserve readable bounded memory", (name) => {
    const type = typeFromName(name);
    const owner = getTypeClass(type);
    expect(readField(compileDescriptor({ kind: "biguint64", isDirectWord: false }), owner, 0)).toBe(type);
    expect(() => readField(compileDescriptor({ kind: "uint32" }), owner, 1_048_576)).toThrow();
});

test("interface vtables require bounded metadata and reject reads beyond it", () => {
    expect(() => getTypeClass(listModelType)).toThrow("generated byte size");
    expect(() => getTypeClass(listModelType, { vtableSize: 8 })).toThrow("smaller than GTypeInterface");
    const owner = getTypeClass(listModelType, { vtableSize: 40 });
    expect(() => readFunction(countSignature(), owner, 40)).toThrow();
});

test("unimplemented interfaces reject acquisition and empty default slots decode as null", () => {
    expect(() => getTypeClass(objectType, { interfaceType: listModelType, vtableSize: 40 })).toThrow(
        "does not implement interface",
    );
    const owner = getTypeClass(listModelType, { vtableSize: 40 });
    expect(readField(compileDescriptor(callbackField(countSignature())), owner, listModelSlot.byteOffset)).toBeNull();
});

test("an interface target retains its owning class across handle collection", async () => {
    const { signature, target, references } = (() => {
        const owner = getTypeClass(listStoreType, { interfaceType: listModelType, vtableSize: 40 });
        const signature = countSignature();
        const target = readFunction(signature, owner, listModelSlot.byteOffset);
        return {
            signature,
            target,
            references: [new WeakRef(owner)],
        };
    })();
    const store = newStore(objectType) as ExternalObject<Handle>;
    const item = newStore(objectType);

    await collect(references);
    expect(call(signature, target, [store]).value).toBe(0);
    append(store, item);
    expect(call(signature, target, [store]).value).toBe(1);
});

test("a class target retains its owning class across handle collection", async () => {
    const { signature, target, references } = (() => {
        const owner = getTypeClass(objectType);
        const signature = bindFunction(
            [
                compileDescriptor({ kind: "biguint64", isDirectWord: false }),
                compileDescriptor({ kind: "uint32" }),
                compileDescriptor({ kind: "buffer" }),
            ],
            compileDescriptor(objectReturn),
            "GObject.constructor",
            { argOrder: [0, 1, 2] },
        );
        const target = readFunction(signature, owner, 16);
        return {
            signature,
            target,
            references: [new WeakRef(owner)],
        };
    })();

    await collect(references);
    const instance = call(signature, target, [objectType, 0, null]).value as ExternalObject<Handle>;
    expect(getType(instance)).toBe(objectType);
});
