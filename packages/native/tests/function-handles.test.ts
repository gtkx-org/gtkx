import {
    alloc,
    bind,
    bindFunctionPointer,
    call,
    type DecodedCallback,
    type Descriptor,
    type ExternalObject,
    type Handle,
    read,
    readFunctionPointer,
    write,
} from "@gtkx/native";
import { resolveExecutable } from "@gtkx/utils";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, test } from "vitest";

const temporary = mkdtempSync(join(tmpdir(), "gtkx-function-handles-"));
const library = join(temporary, "libgtkx-function-handles.so");

beforeAll(() => {
    execFileSync(resolveExecutable("cc"), [
        "-shared",
        "-fPIC",
        "-Wall",
        "-Wextra",
        "-Werror",
        join(import.meta.dirname, "fixtures/function-handles.c"),
        "-o",
        library,
    ]);
});

afterAll(() => {
    rmSync(temporary, { recursive: true, force: true });
});
const VOID: Descriptor = { kind: "void" };
const INT: Descriptor = { kind: "int32" };
const BUFFER: Descriptor = { kind: "buffer" };
const HOLDER: Descriptor = {
    kind: "struct",
    ownership: "borrowed",
    sharedLibrary: library,
    copyFnName: "gtkx_function_holder_ref",
    freeFnName: "gtkx_function_holder_unref",
};
const HOLDER_CALLBACK_OFFSET = 0;

const drain = async (): Promise<void> => {
    for (let index = 0; index < 5; index++) {
        globalThis.gc?.();
        await new Promise<void>((resolve) => setImmediate(resolve));
    }
};

const newHolder = (
    callback: (...args: never[]) => unknown,
    argDescriptors: Descriptor[],
    returnDescriptor: Descriptor,
): ExternalObject<Handle> => {
    const create = bind(
        library,
        "gtkx_function_holder_new",
        [
            {
                kind: "callback",
                argDescriptors: [...argDescriptors, BUFFER],
                returnDescriptor,
                hasUserData: true,
                userDataIndex: argDescriptors.length,
                hasDestroy: true,
                scope: "notified",
            },
        ],
        { ...HOLDER, ownership: "full" },
    );

    return call(create, [callback]).value as ExternalObject<Handle>;
};

const callbackDescriptor = (scope: "call" | "async" | "notified"): Descriptor => ({
    kind: "callback",
    argDescriptors: [INT, BUFFER],
    returnDescriptor: INT,
    hasUserData: true,
    userDataIndex: 1,
    scope,
    hasDestroy: scope === "notified",
});

const receiveCallback = (
    scope: "call" | "async" | "notified",
    receive: (callback: DecodedCallback) => void,
    callback: (value: number) => number,
): void => {
    const descriptor = callbackDescriptor(scope);
    const closure = newHolder(receive, [descriptor], VOID);
    const invoke = bindFunctionPointer(
        readFunctionPointer(closure, HOLDER_CALLBACK_OFFSET),
        [descriptor, BUFFER],
        VOID,
        "callback receiver",
    );
    call(invoke, [callback, null]);
};

const bindCallback = (callback: DecodedCallback) =>
    bindFunctionPointer(callback.function, [INT, BUFFER], INT, "received callback");

const decrementBy =
    (offset: number) =>
    (value: number): number =>
        value - offset;
const increment = (value: number): number => value + 1;
const double = (value: number): number => value * 2;

const held = (value: DecodedCallback | null): DecodedCallback => {
    if (value === null) {
        throw new Error("No callback was received");
    }

    return value;
};

test("a function field keeps its callback holder alive", async () => {
    const functionHandle = readFunctionPointer(
        newHolder((value: number) => value * 2, [INT], INT),
        HOLDER_CALLBACK_OFFSET,
    );
    await drain();
    const invoke = bindFunctionPointer(functionHandle, [INT, BUFFER], INT, "retained callback holder");
    expect(call(invoke, [7, null]).value).toBe(14);
    expect(call(invoke, [-3, null]).value).toBe(-6);
});

test.each([false, true])("callback scalar storage is writable only during its invocation (inout: %s)", (inout) => {
    const captured: { storage: ExternalObject<Handle> | null } = { storage: null };
    const closure = newHolder(
        (storage: ExternalObject<Handle>) => {
            captured.storage = storage;
            expect(read(storage, INT, 0)).toBe(inout ? 7 : 0);
            write(storage, INT, 0, 11);
            expect(() => read(storage, INT, 1)).toThrow();
            expect(() => deferBuffer(storage, held, { kind: "ref", innerDescriptor: INT })).toThrow();
        },
        [{ kind: "ref", innerDescriptor: INT, inout }],
        VOID,
    );
    const invoke = bindFunctionPointer(
        readFunctionPointer(closure, HOLDER_CALLBACK_OFFSET),
        [BUFFER, BUFFER],
        VOID,
        "scalar storage callback",
    );
    const output = alloc(4);
    write(output, INT, 0, 7);

    call(invoke, [output, null]);

    expect(read(output, INT, 0)).toBe(11);
    const storage = captured.storage;
    if (storage === null) {
        throw new Error("The callback did not receive its storage");
    }
    expect(() => read(storage, INT, 0)).toThrow();
    expect(() => write(storage, INT, 0, 12)).toThrow();
});

test("callback scalar storage expires after a handler throws", () => {
    const captured: { storage: ExternalObject<Handle> | null } = { storage: null };
    const closure = newHolder(
        (storage: ExternalObject<Handle>) => {
            captured.storage = storage;
            throw new Error("Callback failure");
        },
        [{ kind: "ref", innerDescriptor: INT }],
        VOID,
    );
    const invoke = bindFunctionPointer(
        readFunctionPointer(closure, HOLDER_CALLBACK_OFFSET),
        [BUFFER, BUFFER],
        VOID,
        "throwing scalar storage callback",
    );
    const output = alloc(4);
    write(output, INT, 0, 7);

    expect(() => call(invoke, [output, null])).toThrow();
    expect(read(output, INT, 0)).toBe(0);

    const storage = captured.storage;
    if (storage === null) {
        throw new Error("The callback did not receive its storage");
    }
    expect(() => read(storage, INT, 0)).toThrow();
    expect(() => write(storage, INT, 0, 12)).toThrow();
});

test("an omitted callback scalar slot arrives as null", () => {
    const observed: (ExternalObject<Handle> | null)[] = [];
    const reference: Descriptor = { kind: "ref", innerDescriptor: INT };
    const closure = newHolder(
        (storage: ExternalObject<Handle> | null) => {
            observed.push(storage);
        },
        [reference],
        VOID,
    );
    const invoke = bindFunctionPointer(
        readFunctionPointer(closure, HOLDER_CALLBACK_OFFSET),
        [reference, BUFFER],
        VOID,
        "optional scalar storage callback",
    );

    call(invoke, [null, null]);

    expect(observed).toEqual([null]);
});

test("received call-scoped function handles expire after the native invocation", () => {
    const captured: { callback: DecodedCallback | null } = { callback: null };
    let invoke: ReturnType<typeof bindCallback> | undefined;
    receiveCallback(
        "call",
        (callback) => {
            captured.callback = callback;
            invoke = bindCallback(callback);
            expect(call(invoke, [4, callback.userData]).value).toBe(12);
        },
        (value) => value * 3,
    );
    const callback = held(captured.callback);
    expect(() => bindCallback(callback)).toThrow();
    if (invoke === undefined) {
        throw new Error("No callback binding was retained");
    }
    const retained = invoke;
    expect(() => call(retained, [5, callback.userData]).value).toThrow();
});

test("callback companions preserve nested calls and scalar outputs beyond eight native arguments", () => {
    const descriptor = callbackDescriptor("notified");
    const reference: Descriptor = { kind: "ref", innerDescriptor: INT };
    const closure = newHolder(
        (first: DecodedCallback, second: DecodedCallback, input: number, storage: ExternalObject<Handle>) => {
            let total = 0;
            for (const callback of [first, second]) {
                const value = call(bindCallback(callback), [input, callback.userData]).value;
                if (typeof value !== "number") {
                    throw new TypeError("The callback did not return a number");
                }
                total += value;
            }
            write(storage, INT, 0, total);

            return total;
        },
        [descriptor, descriptor, INT, reference],
        INT,
    );
    const invoke = bindFunctionPointer(
        readFunctionPointer(closure, HOLDER_CALLBACK_OFFSET),
        [descriptor, descriptor, INT, reference, BUFFER],
        INT,
        "expanded callback companions",
    );
    const output = alloc(4);

    expect(call(invoke, [increment, double, 5, output, null])).toEqual({ value: 16, outputs: [] });
    expect(read(output, INT, 0)).toBe(16);
    expect(() =>
        call(invoke, [
            increment,
            () => {
                throw new Error("Callback failure");
            },
            5,
            output,
            null,
        ]),
    ).toThrow();
    expect(call(invoke, [increment, double, 7, output, null])).toEqual({ value: 22, outputs: [] });
    expect(read(output, INT, 0)).toBe(22);
});

test("received async function handles survive the caller and expire after invocation", async () => {
    const captured: { callback: DecodedCallback | null } = { callback: null };
    receiveCallback(
        "async",
        (callback) => {
            captured.callback = callback;
        },
        (value) => value + 2,
    );
    await drain();
    const callback = held(captured.callback);
    const invoke = bindCallback(callback);
    expect(() => call(invoke, ["bad", callback.userData]).value).toThrow();
    expect(call(invoke, [5, callback.userData]).value).toBe(7);
    expect(() => call(invoke, [6, callback.userData]).value).toThrow();
    expect(() => bindCallback(callback)).toThrow();
});

test("received notified function handles retain callback ownership until collected", async () => {
    const captured: { callback: DecodedCallback | null } = { callback: null };
    const retain = (): WeakRef<(value: number) => number> => {
        const fn = decrementBy(2);
        receiveCallback(
            "notified",
            (callback) => {
                captured.callback = callback;
            },
            fn,
        );

        return new WeakRef(fn);
    };
    const weak = retain();
    await drain();
    const invoke = (): void => {
        const callback = held(captured.callback);
        expect(call(bindCallback(callback), [8, callback.userData]).value).toBe(6);
        expect(call(bindCallback(callback), [3, callback.userData]).value).toBe(1);
    };
    invoke();
    captured.callback = null;
    await drain();
    expect(weak.deref()).toBeUndefined();
});

test("received async function handles reject reentrant invocation", () => {
    const captured: { callback: DecodedCallback | null } = { callback: null };
    receiveCallback(
        "async",
        (callback) => {
            captured.callback = callback;
        },
        (value) => {
            const callback = held(captured.callback);
            expect(() => call(bindCallback(callback), [value, callback.userData]).value).toThrow();

            return value;
        },
    );
    const callback = held(captured.callback);
    expect(call(bindCallback(callback), [7, callback.userData]).value).toBe(7);
});

const DATA_DESCRIPTORS: Descriptor[] = [
    { kind: "object", ownership: "borrowed" },
    { kind: "struct", ownership: "borrowed" },
    { kind: "ref", innerDescriptor: INT },
];

test.each(DATA_DESCRIPTORS)("function handles cannot be passed as $kind data", (descriptor) => {
    const functionHandle = readFunctionPointer(
        newHolder((value: number) => value, [INT], INT),
        HOLDER_CALLBACK_OFFSET,
    );
    const compare = bind(library, "gtkx_function_pointer_equal", [descriptor, descriptor], { kind: "int32" });
    expect(() => call(compare, [functionHandle, functionHandle]).value).toThrow();
});

test.each([
    () => alloc(8),
    () =>
        readFunctionPointer(
            newHolder((value: number) => value, [INT], INT),
            HOLDER_CALLBACK_OFFSET,
        ),
])("native handles cannot be coerced into integer arguments", (createHandle) => {
    const handle = createHandle();
    const integer: Descriptor = { kind: "uint64" };
    const compare = bind(library, "gtkx_function_pointer_equal", [integer, integer], { kind: "int32" });
    expect(() => call(compare, [handle, handle]).value).toThrow();
});

const COMPLETE: Descriptor = {
    kind: "callback",
    argDescriptors: [BUFFER],
    returnDescriptor: VOID,
    scope: "async",
    hasUserData: true,
    userDataIndex: 0,
};

const deferBuffer = (
    buffer: ExternalObject<Handle>,
    receive: (callback: DecodedCallback) => void,
    descriptor: Descriptor = BUFFER,
): { calls: number } => {
    const closure = newHolder(
        (_buffer: ExternalObject<Handle>, callback: DecodedCallback) => {
            receive(callback);
        },
        [{ kind: "struct", ownership: "borrowed" }, COMPLETE],
        VOID,
    );
    const invoke = bindFunctionPointer(
        readFunctionPointer(closure, HOLDER_CALLBACK_OFFSET),
        [descriptor, COMPLETE, BUFFER],
        VOID,
        "deferred buffer receiver",
    );
    const completion = { calls: 0 };
    call(
        invoke,
        [
            buffer,
            () => {
                completion.calls += 1;
            },
            null,
        ],
        1,
    );

    return completion;
};

const completeBuffer = (callback: DecodedCallback): void => {
    const invoke = bindFunctionPointer(callback.function, [BUFFER], VOID, "buffer completion");
    call(invoke, [callback.userData]);
};

test.each(["holder", "function", "field"])("an async buffer retains its %s owner until completion", async (kind) => {
    const captured: { callback: DecodedCallback | null } = { callback: null };
    const begin = (): WeakRef<(value: number) => number> => {
        const fn = decrementBy(4);
        const closure = newHolder(fn, [INT], INT);
        let buffer = closure;
        if (kind === "function") {
            buffer = readFunctionPointer(closure, HOLDER_CALLBACK_OFFSET);
        } else if (kind === "field") {
            buffer = read(
                closure,
                {
                    kind: "struct",
                    ownership: "borrowed",
                    isInline: true,
                    size: 8,
                },
                0,
            ) as ExternalObject<Handle>;
        }
        deferBuffer(buffer, (callback) => {
            captured.callback = callback;
        });

        return new WeakRef(fn);
    };
    const weak = begin();
    await drain();
    expect(weak.deref()).toBeDefined();
    completeBuffer(held(captured.callback));
    captured.callback = null;
    await drain();
    expect(weak.deref()).toBeUndefined();
});

test("an async scalar slot retains its owner until completion", async () => {
    const captured: { callback: DecodedCallback | null } = { callback: null };
    const begin = (): WeakRef<(value: number) => number> => {
        const fn = decrementBy(4);
        const closure = newHolder(fn, [INT], INT);
        const storage = read(
            closure,
            {
                kind: "struct",
                ownership: "borrowed",
                isInline: true,
                size: 4,
            },
            0,
        ) as ExternalObject<Handle>;
        deferBuffer(
            storage,
            (callback) => {
                captured.callback = callback;
            },
            { kind: "ref", innerDescriptor: INT },
        );

        return new WeakRef(fn);
    };
    const weak = begin();
    await drain();
    expect(weak.deref()).toBeDefined();
    completeBuffer(held(captured.callback));
    captured.callback = null;
    await drain();
    expect(weak.deref()).toBeUndefined();
});

test("an async scalar slot requires the completion callback that releases it", () => {
    const reference: Descriptor = { kind: "ref", innerDescriptor: INT };
    const closure = newHolder(() => null, [reference, COMPLETE], VOID);
    const invoke = bindFunctionPointer(
        readFunctionPointer(closure, HOLDER_CALLBACK_OFFSET),
        [reference, COMPLETE, BUFFER],
        VOID,
        "async scalar storage without completion",
    );

    expect(() => call(invoke, [alloc(4), null, null], 1)).toThrow();
});

test("a call-scoped function cannot escape as an async buffer", () => {
    receiveCallback(
        "call",
        (callback) => {
            expect(() => {
                deferBuffer(callback.function, held);
            }).toThrow();
        },
        decrementBy(1),
    );
});

test("an async callback's user data cannot escape into another async buffer", () => {
    const captured: { callback: DecodedCallback | null } = { callback: null };
    receiveCallback(
        "async",
        (callback) => {
            captured.callback = callback;
        },
        decrementBy(1),
    );
    const callback = held(captured.callback);
    if (callback.userData === null) {
        throw new Error("The callback has no user data");
    }
    const data = callback.userData;
    expect(() => {
        deferBuffer(data, held);
    }).toThrow();
    expect(call(bindCallback(callback), [2, data]).value).toBe(1);
});
