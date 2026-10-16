import {
    compileDescriptor,
    alloc,
    call as nativeCall,
    type FunctionSignature,
    bindFunction,
    type Descriptor,
    type ExternalObject,
    type Handle,
    openLibrary,
    type Ref,
    resolveSymbol,
} from "@gtkx/native";
import * as Gio from "@gtkx/gi/gio";
import { getHandle, read, t } from "@gtkx/runtime";
import { expect, test } from "vitest";
import { didSettle, drainGC } from "./helpers/memory.js";

const bytes: Descriptor = { kind: "bytes", ownership: "borrowed", hasOwnedStorage: false };
const encoder = new TextEncoder();
const symbol = (library: string, name: string): ExternalObject<Handle> => {
    const handle = resolveSymbol(openLibrary(library), name, false);
    if (handle == null) throw new Error(`Missing symbol ${name}`);
    return handle;
};
const nativeBind = (name: string, args: Descriptor[]) => ({
    signature: bindFunction(args.map(compileDescriptor), compileDescriptor({ kind: "void" }), name, {
        argOrder: args.map((_, index) => index),
    }),
    target: symbol("libc.so.6", name),
});
const call = (
    bound: { signature: ExternalObject<FunctionSignature>; target: ExternalObject<Handle> },
    values: unknown[] | ((index: number) => unknown),
    completionIndex?: number,
) => nativeCall(bound.signature, bound.target, values, completionIndex);
const ref = (innerDescriptor: Descriptor, inout: boolean): Descriptor => ({ kind: "ref", innerDescriptor, inout });

test("owned reference transactions preserve unchanged, replaced, and null string slots", () => {
    const parse = t.bind("libc.so.6", "strtol", [t.string(), t.ref(t.string()), t.int32], t.int64);
    const end: { value: unknown } = { value: null };
    expect(parse("123tail", end, 10)).toBe(123);
    expect(end.value).toBe("tail");

    const separate = t.bind("libc.so.6", "strsep", [t.ref(t.string(), true), t.string()], t.string());
    const input: { value: unknown } = { value: "left:right" };
    expect(separate(input, ":")).toBe("left");
    expect(input.value).toBe("right");
    expect(separate(input, ":")).toBe("right");
    expect(input.value).toBeNull();
    expect(separate(input, ":")).toBeNull();
    expect(input.value).toBeNull();
});

test("plain reference cells can be reused across calls and independently bound signatures", () => {
    const arguments_ = [bytes, ref(bytes, false), { kind: "int32" } satisfies Descriptor];
    const first = nativeBind("strtol", arguments_);
    const second = nativeBind("strtol", arguments_);
    const cell = { value: null };

    expect(call(first, [encoder.encode("1tail"), cell, 10]).outputs).toEqual([
        { index: 1, value: encoder.encode("tail") },
    ]);
    expect(call(second, [encoder.encode("2next"), cell, 10]).outputs).toEqual([
        { index: 1, value: encoder.encode("next") },
    ]);
    expect(call(first, [encoder.encode("3"), cell, 10]).outputs).toEqual([{ index: 1, value: encoder.encode("") }]);
});

test("reference storage uses logical argument positions before ABI reordering", () => {
    const signature = bindFunction(
        [compileDescriptor(ref(bytes, false)), compileDescriptor(bytes), compileDescriptor({ kind: "int32" })],
        compileDescriptor({ kind: "void" }),
        "strtol",
        {
            argOrder: [1, 0, 2],
        },
    );
    const result = nativeCall(signature, symbol("libc.so.6", "strtol"), [
        { value: null },
        encoder.encode("123tail"),
        10,
    ]);
    expect(result.outputs).toEqual([{ index: 0, value: encoder.encode("tail") }]);
});

test("caller-allocated reference outputs remain bounded by their supplied allocation", () => {
    const array = ref(
        {
            kind: "array",
            itemDescriptor: { kind: "uint8" },
            arrayKind: "sized",
            ownership: "borrowed",
            elementOwnership: "separate",
            isBytes: false,
            isCallerAllocated: true,
            isZeroTerminated: false,
            sizeParamIndex: 1,
        },
        false,
    );
    const target = nativeBind("memset", [array, { kind: "int32" }, { kind: "biguint64", isDirectWord: false }]);
    const storage = { value: alloc(1) };
    expect(call(target, [storage, 1, 0n]).outputs).toEqual([{ index: 0, value: [0] }]);
    expect(() => call(target, [storage, 2, 0n])).toThrow("exceeds its capacity");
    expect(call(target, [{ value: alloc(0) }, 0, 0n]).outputs).toEqual([{ index: 0, value: [] }]);
});

test("runtime allocates caller array capacity with its element width and rejects excessive sizes", () => {
    const fill = t.bind(
        "libc.so.6",
        "memset",
        [
            t.ref(t.array(t.uint32, "sized", "borrowed", { isCallerAllocated: true, sizeParamIndex: 1 })),
            t.int32,
            t.biguint64,
        ],
        t.void,
    );
    const output: { value: unknown } = { value: 2n };
    fill(output, 2, 8n);
    expect(output.value).toEqual([0x02020202, 0x02020202]);
    const empty: { value: unknown } = { value: 0 };
    fill(empty, 0, 0n);
    expect(empty.value).toEqual([]);
    expect(() => fill({ value: 134_217_729 }, 0, 0n)).toThrow("exceeds the supported range");
});

test("fixed caller-allocated references reject undersized allocations before native writes", () => {
    const array = ref(
        {
            kind: "array",
            itemDescriptor: { kind: "uint8" },
            arrayKind: "fixed",
            fixedSize: 2,
            ownership: "borrowed",
            elementOwnership: "separate",
            isBytes: false,
            isCallerAllocated: true,
            isZeroTerminated: false,
        },
        false,
    );
    const target = nativeBind("memset", [array, { kind: "int32" }, { kind: "biguint64", isDirectWord: false }]);
    const storage = alloc(1);

    expect(() => call(target, [{ value: storage }, 42, 2n])).toThrow();
    expect(read(storage, t.uint8, 0)).toBe(0);
    expect(call(target, [{ value: alloc(2) }, 42, 2n]).outputs).toEqual([{ index: 0, value: [42, 42] }]);
});

test("callback reference cells cannot change native storage after their invocation returns", () => {
    const reference = ref(bytes, true);
    const callback: Descriptor = {
        kind: "callback",
        signature: bindFunction(
            [compileDescriptor(reference), compileDescriptor(reference)],
            compileDescriptor({ kind: "int32" }),
            "reference comparator",
            { argOrder: [0, 1] },
            {},
        ),
        hasDestroy: false,
        destroyKind: "destroyNotify",
        hasUserData: false,
        scope: "call",
        releaseWithCompletion: false,
    };
    const sort = nativeBind("qsort", [
        { kind: "buffer" },
        { kind: "biguint64", isDirectWord: false },
        { kind: "biguint64", isDirectWord: false },
        callback,
    ]);
    const source = alloc(16);

    const held: { cell?: Ref } = {};
    call(sort, [
        source,
        2n,
        8n,
        (left: Ref, right: Ref) => {
            held.cell = left;
            expect(left.value).toBeNull();
            expect(right.value).toBeNull();
            left.value = null;
            right.value = null;
            return 0;
        },
    ]);
    expect([read(source, t.string(), 0), read(source, t.string(), 8)]).toEqual([null, null]);
    if (held.cell === undefined) throw new Error("The comparator did not receive reference storage");
    held.cell.value = encoder.encode("after return");
    expect([read(source, t.string(), 0), read(source, t.string(), 8)]).toEqual([null, null]);
});

test("failed public output conversion releases later owned reference outputs", async () => {
    const scan = t.bind(
        "libc.so.6",
        "sscanf",
        [t.string(), t.string(), t.ref(t.uint64), t.ref(t.string("full"))],
        t.int32,
    );
    const number: { value: unknown } = { value: null };
    const string: { value: unknown } = { value: null };
    expect(() => scan("18446744073709551615 text", "%lu %ms", number, string)).toThrow();
    expect(number.value).toBeNull();
    expect(string.value).toBeNull();
    await drainGC();
    expect(scan("42 recovered", "%lu %ms", number, string)).toBe(2);
    expect(number.value).toBe(42);
    expect(string.value).toBe("recovered");
});

test("synchronous reference buffers preserve typed subview mutation", () => {
    const decode = t.bind(
        "libglib-2.0.so.0",
        "g_base64_decode_inplace",
        [t.ref(t.array(t.uint8, "fixed", "borrowed", { fixedSize: 5 })), t.ref(t.biguint64)],
        t.struct(),
    );
    const backing = Uint8Array.of(11, 89, 87, 74, 106, 0, 22);
    const buffer = { value: backing.subarray(1, 6) };
    const length = { value: null };
    decode(buffer, length);
    expect(length.value).toBe(3n);
    expect(backing.subarray(0, 4)).toEqual(Uint8Array.of(11, 97, 98, 99));
    expect(backing[6]).toBe(22);
});

test.each(["borrowed", "full"] as const)(
    "%s reference seeds retain nested native owners during later argument reentry and collection",
    (ownership) => {
        const gc = globalThis.gc;
        if (gc === undefined) throw new Error("Reference ownership tests require --expose-gc");
        const object: Descriptor = { kind: "object", ownership, isCallScoped: false };
        const array = ref(
            {
                kind: "array",
                itemDescriptor: object,
                arrayKind: "fixed",
                fixedSize: 1,
                ownership: "borrowed",
                elementOwnership: "separate",
                isBytes: false,
                isCallerAllocated: false,
                isZeroTerminated: false,
            },
            true,
        );
        const name = t.bind("libgio-2.0.so.0", "g_action_get_name", [t.object()], t.string());
        const target = nativeBind("memset", [array, { kind: "int32" }, { kind: "biguint64", isDirectWord: false }]);
        const nested = nativeBind("strtol", [bytes, ref(bytes, false), { kind: "int32" }]);
        const output = call(target, (index) => {
            if (index === 0) return { value: [getHandle(new Gio.SimpleAction({ name: "retained" }))] };
            if (index === 1) {
                call(nested, [encoder.encode("1nested"), { value: null }, 10]);
                gc();
                return 0;
            }
            return 0n;
        }).outputs[0]?.value as unknown[];
        expect(name(output[0])).toBe("retained");
    },
);

test("a failed argument producer releases earlier reference owners and leaves the signature reusable", async () => {
    const target = nativeBind("memset", [
        ref({ kind: "object", ownership: "borrowed", isCallScoped: false }, true),
        { kind: "int32" },
        { kind: "biguint64", isDirectWord: false },
    ]);
    const held: { reference?: WeakRef<Gio.SimpleAction> } = {};
    const failure = new Error("argument production failed");

    expect(() =>
        call(target, (index) => {
            if (index === 0) {
                const action = new Gio.SimpleAction({ name: "released" });
                held.reference = new WeakRef(action);
                return { value: getHandle(action) };
            }
            throw failure;
        }),
    ).toThrow(failure);
    const reference = held.reference;
    if (reference === undefined) throw new Error("The producer did not create its reference seed");
    expect(await didSettle(() => reference.deref() === undefined)).toBe(true);

    const action = new Gio.SimpleAction({ name: "recovered" });
    const name = t.bind("libgio-2.0.so.0", "g_action_get_name", [t.object()], t.string());
    const output = call(target, [{ value: getHandle(action) }, 0, 0n]).outputs[0]?.value;
    expect(name(output)).toBe("recovered");
});

test("reference buffers detached by a later argument producer are rejected before native access", () => {
    const array = ref(
        {
            kind: "array",
            itemDescriptor: { kind: "uint8" },
            arrayKind: "fixed",
            fixedSize: 3,
            ownership: "borrowed",
            elementOwnership: "separate",
            isBytes: false,
            isCallerAllocated: false,
            isZeroTerminated: false,
        },
        true,
    );
    const target = nativeBind("memset", [array, { kind: "int32" }, { kind: "biguint64", isDirectWord: false }]);
    const seed = Uint8Array.of(7, 8, 9);

    expect(() =>
        call(target, (index) => {
            if (index === 0) return { value: seed };
            if (index === 1) {
                structuredClone(seed.buffer, { transfer: [seed.buffer] });
                return 0;
            }
            return 0n;
        }),
    ).toThrow();
    expect(call(target, [{ value: Uint8Array.of(4, 5, 6) }, 0, 0n]).outputs).toEqual([{ index: 0, value: [4, 5, 6] }]);
});

test("asynchronous reference storage owns typed seeds until completion", async () => {
    const array = ref(
        {
            kind: "array",
            itemDescriptor: { kind: "uint8" },
            arrayKind: "fixed",
            fixedSize: 3,
            ownership: "borrowed",
            elementOwnership: "separate",
            isBytes: false,
            isCallerAllocated: false,
            isZeroTerminated: false,
        },
        true,
    );
    const pointer: Descriptor = {
        kind: "struct",
        ownership: "borrowed",
        isCallerAllocated: false,
        isInline: false,
        isValueSafe: false,
    };
    const callback: Descriptor = {
        kind: "callback",
        signature: bindFunction(
            [compileDescriptor(pointer)],
            compileDescriptor({ kind: "int32" }),
            "completion callback",
            { argOrder: [0] },
            {},
        ),
        hasDestroy: false,
        destroyKind: "destroyNotify",
        hasUserData: false,
        scope: "async",
        releaseWithCompletion: false,
    };
    const signature = bindFunction(
        [
            compileDescriptor({ kind: "int32" }),
            compileDescriptor({ kind: "uint32" }),
            compileDescriptor(callback),
            compileDescriptor(array),
            compileDescriptor(pointer),
        ],
        compileDescriptor({ kind: "uint32" }),
        "g_timeout_add_full",
        { argOrder: [0, 1, 2, 3, 4] },
    );
    const target = { signature, target: symbol("libglib-2.0.so.0", "g_timeout_add_full") };
    const { promise, resolve } = Promise.withResolvers<number[]>();
    const seed = Uint8Array.of(7, 8, 9);
    call(
        target,
        [
            0,
            100,
            (slot: ExternalObject<Handle>) => {
                const data = read(slot, t.struct(), 0) as ExternalObject<Handle>;
                resolve([read(data, t.uint8, 0), read(data, t.uint8, 1), read(data, t.uint8, 2)] as number[]);
                return 0;
            },
            { value: seed },
            null,
        ],
        2,
    );
    seed.fill(99);
    await drainGC();
    expect(await promise).toEqual([7, 8, 9]);
});

test("asynchronous reference outputs reject ownership transfers before native invocation", () => {
    const reference = ref({ ...bytes, ownership: "full" }, true);
    const callback: Descriptor = {
        kind: "callback",
        signature: bindFunction([], compileDescriptor({ kind: "void" }), "completion callback", { argOrder: [] }, {}),
        hasDestroy: false,
        destroyKind: "destroyNotify",
        hasUserData: false,
        scope: "async",
        releaseWithCompletion: false,
    };
    const target = nativeBind("getpid", [reference, callback]);
    expect(() => call(target, [{ value: encoder.encode("still owned") }, () => undefined], 1)).toThrow(
        "must borrow all native resources",
    );
});

test("reference array replacements inside a typed seed retain its remaining bound", () => {
    const split = t.bind(
        "libc.so.6",
        "strsep",
        [t.ref(t.array(t.uint8, "fixed", "borrowed", { fixedSize: 4 }), true), t.string()],
        t.string(),
    );
    const backing = Uint8Array.of(11, 97, 58, 98, 0, 22);
    const seed = { value: backing.subarray(1, 5) };
    expect(() => split(seed, ":")).toThrow("exceeds its capacity: 4 bytes requested, 2 available");
    expect(backing).toEqual(Uint8Array.of(11, 97, 0, 98, 0, 22));
});
