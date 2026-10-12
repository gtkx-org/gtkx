import {
    alloc,
    attachCall,
    call,
    compileCall,
    compileReference,
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
const nativeBind = (name: string, args: Descriptor[]) =>
    attachCall(
        compileCall(args, { kind: "void" }, name, { argOrder: args.map((_, index) => index) }),
        symbol("libc.so.6", name),
    );

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
    const borrowed = compileReference(bytes, false);
    const owned = compileReference({ ...bytes, ownership: "full" }, false);
    const target = nativeBind("strtol", [bytes, { kind: "reference", reference: borrowed }, { kind: "int32" }]);
    const wrong = createReferenceStorage(owned, null, "slot");
    expect(() => call(target, [encoder.encode("1tail"), wrong, 10])).toThrow("another descriptor");
    const storage = createReferenceStorage(borrowed, null, "slot");
    expect(call(target, [encoder.encode("1tail"), storage, 10]).outputs[0]?.value).toEqual(encoder.encode("tail"));
    expect(() => call(target, [encoder.encode("1tail"), storage, 10])).toThrow("already been consumed");
});

test("reference storage validates explicit modes and returned capacity before reading memory", () => {
    const string = compileReference(bytes, false);
    expect(() => createReferenceStorage(string, null, "callerArray", 1n)).toThrow("array descriptor");
    expect(() => createReferenceStorage(string, null, "inout")).toThrow("out reference");
    const array = compileReference(
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
    const target = nativeBind("memset", [
        { kind: "reference", reference: array },
        { kind: "int32" },
        { kind: "biguint64", isDirectWord: false },
    ]);
    expect(() => createReferenceStorage(array, null, "callerArray", -1n)).toThrow("capacity");
    const storage = createReferenceStorage(array, null, "callerArray", 1n);
    expect(() => call(target, [storage, 2, 0n])).toThrow("exceeds its capacity");
});

test("callback reference cells cannot change native storage after their invocation returns", () => {
    const reference = compileReference(bytes, true);
    const callback: Descriptor = {
        kind: "callback",
        argDescriptors: [
            { kind: "reference", reference },
            { kind: "reference", reference },
        ],
        returnDescriptor: { kind: "int32" },
        hasDestroy: false,
        destroyKind: "destroyNotify",
        hasUserData: false,
        canThrow: false,
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
        const array = compileReference(
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
        const storage = createReferenceStorage(array, [getHandle(new Gio.SimpleAction({ name: "retained" }))], "inout");
        await drainGC();
        const target = nativeBind("memset", [
            { kind: "reference", reference: array },
            { kind: "int32" },
            { kind: "biguint64", isDirectWord: false },
        ]);
        const output = call(target, [storage, 0, 0n]).outputs[0]?.value as unknown[];
        expect(name(output[0])).toBe("retained");
    },
);

test("asynchronous reference storage owns typed seeds until completion", async () => {
    const array = compileReference(
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
        argDescriptors: [pointer],
        returnDescriptor: { kind: "int32" },
        hasDestroy: false,
        destroyKind: "destroyNotify",
        hasUserData: false,
        canThrow: false,
        scope: "async",
        releaseWithCompletion: false,
    };
    const signature = compileCall(
        [{ kind: "int32" }, { kind: "uint32" }, callback, { kind: "reference", reference: array }, pointer],
        { kind: "uint32" },
        "g_timeout_add_full",
        { argOrder: [0, 1, 2, 3, 4] },
    );
    const target = attachCall(signature, symbol("libglib-2.0.so.0", "g_timeout_add_full"));
    const { promise, resolve } = Promise.withResolvers<number[]>();
    const seed = Uint8Array.of(7, 8, 9);
    const storage = createReferenceStorage(array, seed, "inout");
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
    const reference = compileReference({ ...bytes, ownership: "full" }, true);
    const callback: Descriptor = {
        kind: "callback",
        argDescriptors: [],
        returnDescriptor: { kind: "void" },
        hasDestroy: false,
        destroyKind: "destroyNotify",
        hasUserData: false,
        canThrow: false,
        scope: "async",
        releaseWithCompletion: false,
    };
    const target = nativeBind("getpid", [{ kind: "reference", reference }, callback]);
    const storage = createReferenceStorage(reference, encoder.encode("still owned"), "inout");
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
