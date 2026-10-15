import {
    compileDescriptor,
    alloc,
    call as nativeCall,
    type FunctionSignature,
    bindFunction,
    createReferenceStorage,
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
import { drainGC } from "./helpers/memory.js";

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
    values: unknown[],
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

test("reference storage rejects different ownership contracts and repeated consumption", () => {
    const borrowed = ref(bytes, false);
    const owned = ref({ ...bytes, ownership: "full" }, false);
    const target = nativeBind("strtol", [bytes, borrowed, { kind: "int32" }]);
    const other = nativeBind("strtol", [bytes, owned, { kind: "int32" }]);
    const wrong = createReferenceStorage(other.signature, 1, null, "slot");
    expect(() => call(target, [encoder.encode("1tail"), wrong, 10])).toThrow("another descriptor");
    const storage = createReferenceStorage(target.signature, 1, null, "slot");
    expect(call(target, [encoder.encode("1tail"), storage, 10]).outputs[0]?.value).toEqual(encoder.encode("tail"));
    expect(() => call(target, [encoder.encode("1tail"), storage, 10])).toThrow("already been consumed");
});

test("reference storage requires a non-scalar reference argument in the compiled signature", () => {
    const target = nativeBind("getpid", [{ kind: "int32" }, ref({ kind: "int32" }, false)]);
    expect(() => createReferenceStorage(target.signature, 0, null, "slot")).toThrow("non-scalar reference");
    expect(() => createReferenceStorage(target.signature, 1, null, "slot")).toThrow("non-scalar reference");
    expect(() => createReferenceStorage(target.signature, 2, null, "slot")).toThrow("exceeds the compiled signature");
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
    const storage = createReferenceStorage(signature, 0, null, "slot");
    const result = nativeCall(signature, symbol("libc.so.6", "strtol"), [storage, encoder.encode("123tail"), 10]);
    expect(result.outputs).toEqual([{ index: 0, value: encoder.encode("tail") }]);
});

test("reference storage validates explicit modes and returned capacity before reading memory", () => {
    const string = nativeBind("strtol", [bytes, ref(bytes, false), { kind: "int32" }]);
    expect(() => createReferenceStorage(string.signature, 1, null, "callerArray", 1n)).toThrow("array descriptor");
    expect(() => createReferenceStorage(string.signature, 1, null, "inout")).toThrow("out reference");
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
    expect(() => createReferenceStorage(target.signature, 0, null, "callerArray", -1n)).toThrow("capacity");
    const storage = createReferenceStorage(target.signature, 0, null, "callerArray", 1n);
    expect(() => call(target, [storage, 2, 0n])).toThrow("exceeds its capacity");
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
    "deferred %s reference seeds retain nested native owners across garbage collection",
    async (ownership) => {
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
        const storage = createReferenceStorage(
            target.signature,
            0,
            [getHandle(new Gio.SimpleAction({ name: "retained" }))],
            "inout",
        );
        await drainGC();
        const output = call(target, [storage, 0, 0n]).outputs[0]?.value as unknown[];
        expect(name(output[0])).toBe("retained");
    },
);

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
    const storage = createReferenceStorage(signature, 3, seed, "inout");
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
            storage,
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
    const storage = createReferenceStorage(target.signature, 0, encoder.encode("still owned"), "inout");
    expect(() => call(target, [storage, () => undefined], 1)).toThrow("must borrow all native resources");
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
