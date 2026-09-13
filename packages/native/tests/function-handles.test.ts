import {
    alloc,
    bind,
    bindFunctionPointer,
    call,
    type DecodedCallback,
    type Descriptor,
    type ExternalObject,
    type Handle,
    newObject,
    read,
    readFunctionPointer,
    resolveType,
    setWrapper,
} from "@gtkx/native";
import { expect, test } from "vitest";

const GOBJECT = "libgobject-2.0.so.0";
const VOID: Descriptor = { kind: "void" };
const INT: Descriptor = { kind: "int32" };
const BUFFER: Descriptor = { kind: "buffer" };
const CLOSURE: Descriptor = {
    kind: "boxed",
    ownership: "borrowed",
    typeName: "GClosure",
    sharedLibrary: GOBJECT,
    getTypeFnName: "g_closure_get_type",
};
const CLOSURE_CALLBACK_OFFSET = 32;
const refClosure = bind(GOBJECT, "g_closure_ref", [CLOSURE], VOID);
const sinkClosure = bind(GOBJECT, "g_closure_sink", [CLOSURE], VOID);

const drain = async (): Promise<void> => {
    for (let index = 0; index < 5; index++) {
        globalThis.gc?.();
        await new Promise<void>((resolve) => setImmediate(resolve));
    }
};

const newClosure = (
    callback: (...args: never[]) => unknown,
    argDescriptors: Descriptor[],
    returnDescriptor: Descriptor,
): ExternalObject<Handle> => {
    const create = bind(GOBJECT, "g_cclosure_new", [{
        kind: "callback",
        argDescriptors: [...argDescriptors, BUFFER],
        returnDescriptor,
        hasUserData: true,
        userDataIndex: argDescriptors.length,
        hasDestroy: true,
        destroyKind: "closureNotify",
        scope: "notified",
    }], { ...CLOSURE, ownership: "full" });
    const closure = call(create, [callback]).value as ExternalObject<Handle>;
    call(refClosure, [closure]);
    call(sinkClosure, [closure]);

    return closure;
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
    const closure = newClosure(receive, [descriptor], VOID);
    const invoke = bindFunctionPointer(
        readFunctionPointer(closure, CLOSURE_CALLBACK_OFFSET),
        [descriptor, BUFFER],
        VOID,
        "callback receiver",
    );
    call(invoke, [callback, null]);
};

const bindCallback = (callback: DecodedCallback) =>
    bindFunctionPointer(callback.function, [INT, BUFFER], INT, "received callback");

const decrementBy = (offset: number) => (value: number): number => value - offset;

const held = (value: DecodedCallback | null): DecodedCallback => {
    if (value === null) {
        throw new Error("No callback was received");
    }

    return value;
};

test("a function field keeps its owning closure alive", async () => {
    const functionHandle = readFunctionPointer(
        newClosure((value: number) => value * 2, [INT], INT),
        CLOSURE_CALLBACK_OFFSET,
    );
    await drain();
    const invoke = bindFunctionPointer(functionHandle, [INT, BUFFER], INT, "retained closure");
    expect(call(invoke, [7, null]).value).toBe(14);
    expect(call(invoke, [-3, null]).value).toBe(-6);
});

test("received call-scoped function handles expire after the native invocation", () => {
    const captured: { callback: DecodedCallback | null } = { callback: null };
    let invoke: ReturnType<typeof bindCallback> | undefined;
    receiveCallback("call", (callback) => {
        captured.callback = callback;
        invoke = bindCallback(callback);
        expect(call(invoke, [4, callback.userData]).value).toBe(12);
    }, (value) => value * 3);
    const callback = held(captured.callback);
    expect(() => bindCallback(callback)).toThrow();
    if (invoke === undefined) {
        throw new Error("No callback binding was retained");
    }
    const retained = invoke;
    expect(() => call(retained, [5, callback.userData]).value).toThrow();
});

test("received async function handles survive the caller and expire after invocation", async () => {
    const captured: { callback: DecodedCallback | null } = { callback: null };
    receiveCallback("async", (callback) => {
        captured.callback = callback;
    }, (value) => value + 2);
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
        receiveCallback("notified", (callback) => {
            captured.callback = callback;
        }, fn);

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
    receiveCallback("async", (callback) => {
        captured.callback = callback;
    }, (value) => {
        const callback = held(captured.callback);
        expect(() => call(bindCallback(callback), [value, callback.userData]).value).toThrow();

        return value;
    });
    const callback = held(captured.callback);
    expect(call(bindCallback(callback), [7, callback.userData]).value).toBe(7);
});

const DATA_DESCRIPTORS: Descriptor[] = [
    { kind: "object", ownership: "borrowed" },
    { kind: "struct", ownership: "borrowed" },
    CLOSURE,
];

test.each(DATA_DESCRIPTORS)("function handles cannot be passed as $kind data", (descriptor) => {
    const functionHandle = readFunctionPointer(
        newClosure((value: number) => value, [INT], INT),
        CLOSURE_CALLBACK_OFFSET,
    );
    const compare = bind("libglib-2.0.so.0", "g_direct_equal", [descriptor, descriptor], { kind: "int32" });
    expect(() => call(compare, [functionHandle, functionHandle]).value).toThrow();
});

test.each([
    alloc(8),
    readFunctionPointer(newClosure((value: number) => value, [INT], INT), CLOSURE_CALLBACK_OFFSET),
])(
    "native handles cannot be coerced into integer arguments",
    (handle) => {
        const integer: Descriptor = { kind: "uint64" };
        const compare = bind("libglib-2.0.so.0", "g_direct_equal", [integer, integer], { kind: "int32" });
        expect(() => call(compare, [handle, handle]).value).toThrow();
    },
);

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
): { calls: number } => {
    const closure = newClosure((_buffer: ExternalObject<Handle>, callback: DecodedCallback) => {
        receive(callback);
    }, [{ kind: "struct", ownership: "borrowed" }, COMPLETE], VOID);
    const invoke = bindFunctionPointer(
        readFunctionPointer(closure, CLOSURE_CALLBACK_OFFSET),
        [BUFFER, COMPLETE, BUFFER],
        VOID,
        "deferred buffer receiver",
    );
    const completion = { calls: 0 };
    call(invoke, [buffer, () => {
        completion.calls += 1;
    }, null], 1);

    return completion;
};

const completeBuffer = (callback: DecodedCallback): void => {
    const invoke = bindFunctionPointer(callback.function, [BUFFER], VOID, "buffer completion");
    call(invoke, [callback.userData]);
};

test.each(["closure", "function", "field"])("an async buffer retains its %s owner until completion", async (kind) => {
    const captured: { callback: DecodedCallback | null } = { callback: null };
    const begin = (): WeakRef<(value: number) => number> => {
        const fn = decrementBy(4);
        const closure = newClosure(fn, [INT], INT);
        let buffer = closure;
        if (kind === "function") {
            buffer = readFunctionPointer(closure, CLOSURE_CALLBACK_OFFSET);
        } else if (kind === "field") {
            buffer = read(closure, {
                kind: "struct", ownership: "borrowed", isInline: true, size: 8,
            }, 0) as ExternalObject<Handle>;
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

test("a call-scoped function cannot escape as an async buffer", () => {
    receiveCallback("call", (callback) => {
        expect(() => {
            deferBuffer(callback.function, held);
        }).toThrow();
    }, decrementBy(1));
});

test("an async callback's user data cannot escape into another async buffer", () => {
    const captured: { callback: DecodedCallback | null } = { callback: null };
    receiveCallback("async", (callback) => {
        captured.callback = callback;
    }, decrementBy(1));
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

test("an async buffer pins a GObject after ownership passes to its wrapper", async () => {
    const captured: { callback: DecodedCallback | null } = { callback: null };
    const begin = (): WeakRef<object> => {
        const wrapper = {};
        newObject(resolveType(GOBJECT, "g_object_get_type"), [], [], wrapper, (handle) => {
            setWrapper(handle, wrapper);
            deferBuffer(handle, (callback) => {
                captured.callback = callback;
            });
        });

        return new WeakRef(wrapper);
    };
    const weak = begin();
    await drain();
    expect(weak.deref()).toBeDefined();
    completeBuffer(held(captured.callback));
    captured.callback = null;
    await drain();
    expect(weak.deref()).toBeUndefined();
});
