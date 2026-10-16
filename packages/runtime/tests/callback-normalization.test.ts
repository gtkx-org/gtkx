import { alloc, type ExternalObject, getHandle, type Handle, read, t, wrapHandle, write } from "@gtkx/runtime";
import { expect, test } from "vitest";

test.each([false, true])("callbacks sort native storage with user data set to %s", (hasUserData) => {
    const compare = t.callback(
        hasUserData ? [t.struct(), t.struct(), t.buffer] : [t.struct(), t.struct()],
        t.int32,
        hasUserData ? { hasUserData: true, userDataIndex: 2 } : { scope: "call" },
    );
    const sort = t.bind(
        "libc.so.6",
        hasUserData ? "qsort_r" : "qsort",
        [t.struct(), t.biguint64, t.biguint64, compare],
        t.void,
    );
    const values = [17, -4, 42, 0];
    const storage = alloc(values.length * 4);
    for (const [index, value] of values.entries()) {
        write(storage, t.int32, index * 4, value);
    }

    let comparisons = 0;
    sort(storage, BigInt(values.length), 4n, (left: ExternalObject<Handle>, right: ExternalObject<Handle>) => {
        comparisons += 1;
        return (read(left, t.int32, 0) as number) - (read(right, t.int32, 0) as number);
    });

    expect(comparisons).toBeGreaterThan(0);
    expect(values.map((_, index) => read(storage, t.int32, index * 4))).toEqual([-4, 0, 17, 42]);
});

test.each([false, true])("retained callbacks accept explicit hidden positions set to %s", async (explicit) => {
    const callback = t.callback([t.buffer], t.boolean, {
        hasUserData: true,
        hasDestroy: true,
        userDataIndex: 0,
        ...(explicit ? { userDataArgIndex: 2, destroyArgIndex: 3 } : {}),
    });
    const idle = t.bind("libglib-2.0.so.0", "g_idle_add_full", [t.int32, callback], t.uint32);
    const { promise, resolve } = Promise.withResolvers<void>();
    let calls = 0;

    expect(
        idle(0, () => {
            calls += 1;
            resolve();
            return false;
        }),
    ).toBeGreaterThan(0);
    expect(calls).toBe(0);
    await promise;
    expect(calls).toBe(1);
});

test("callbacks copy returned records into caller-owned storage on repeated calls", () => {
    class Record {}

    const callback = t.callback(
        [t.struct("borrowed", { size: 8, isCallerAllocated: true, wrapperClass: Record }), t.buffer],
        t.void,
        { scope: "call", hasUserData: true, userDataIndex: 1 },
    );
    const visit = t.fn("libglib-2.0.so.0", "g_list_foreach", {
        args: [{ type: t.list(t.struct()) }, { type: callback }],
        returns: t.void,
    });
    const storage = alloc(8);
    const source = alloc(8);
    const replacement = wrapHandle(source, Record);
    const seen: number[] = [];

    const replace = (record: Record): Record => {
        seen.push(read(getHandle(record), t.int32, 0) as number);
        return replacement;
    };

    write(source, t.int32, 0, 42);
    write(source, t.int32, 4, -7);
    visit([storage], replace);
    expect(read(storage, t.int32, 0)).toBe(42);
    expect(read(storage, t.int32, 4)).toBe(-7);

    write(source, t.int32, 0, 81);
    write(source, t.int32, 4, 19);
    visit([storage], replace);
    expect(read(storage, t.int32, 0)).toBe(81);
    expect(read(storage, t.int32, 4)).toBe(19);
    expect(seen).toEqual([0, 42]);

    visit([storage], (record: Record) => record);
    expect(read(storage, t.int32, 0)).toBe(81);
    expect(read(storage, t.int32, 4)).toBe(19);

    expect(() => visit([storage], () => wrapHandle(alloc(4), Record))).toThrow("exceeds the handle's 4 bytes");
    expect(read(storage, t.int32, 0)).toBe(81);
    expect(read(storage, t.int32, 4)).toBe(19);
});

test.each([-1, 0.5, 2 ** 32, Number.NaN])("callback record output rejects an invalid byte size %s", (size) => {
    class Record {}

    const callback = t.callback(
        [t.struct("borrowed", { size, isCallerAllocated: true, wrapperClass: Record }), t.buffer],
        t.void,
        { scope: "call", hasUserData: true, userDataIndex: 1 },
    );
    const visit = t.fn("libglib-2.0.so.0", "g_list_foreach", {
        args: [{ type: t.list(t.struct()) }, { type: callback }],
        returns: t.void,
    });
    const target = alloc(8);
    const source = alloc(8);
    write(source, t.int32, 0, 42);

    expect(() => visit([target], () => wrapHandle(source, Record))).toThrow("record size must fit");
    expect(read(target, t.int32, 0)).toBe(0);
});

test("callback user data can precede its function pointer", () => {
    const quark = t.bind("libglib-2.0.so.0", "g_quark_from_string", [t.string()], t.uint32);
    const destroy = t.callback([t.buffer], t.void, {
        hasUserData: true,
        userDataIndex: 0,
        userDataArgIndex: 2,
        scope: "async",
    });
    const setData = t.bind("libglib-2.0.so.0", "g_dataset_id_set_data_full", [t.struct(), t.uint32, destroy], t.void);
    const clear = t.bind("libglib-2.0.so.0", "g_dataset_destroy", [t.struct()], t.void);
    const location = alloc(1);
    let calls = 0;

    setData(location, quark("gtkx-runtime-call-layout"), () => {
        calls += 1;
    });
    expect(calls).toBe(0);
    clear(location);
    expect(calls).toBe(1);
    clear(location);
    expect(calls).toBe(1);
});

test.each([
    { hasUserData: false, userDataArgIndex: 0 },
    { hasUserData: true, userDataArgIndex: 3 },
    { hasUserData: true, userDataArgIndex: -1 },
    { hasUserData: true, userDataArgIndex: 0.5 },
    { hasUserData: true, hasDestroy: true, userDataArgIndex: 1, destroyArgIndex: 1 },
])("invalid callback positions fail before symbol resolution: %j", (options) => {
    const callback = t.callback([t.buffer], t.void, { ...options, userDataIndex: 0 });

    expect(() => t.bind("libgtkx-missing.so", "missing", [callback], t.void)).toThrow(/callback.*position/i);
});

test.each([false, true])(
    "variadic fixed-prefix callbacks preserve hidden arguments with explicit positions %s",
    (explicit) => {
        class AsyncResult {}

        const callback = t.callback(
            [t.struct(), t.struct("borrowed", { wrapperClass: AsyncResult }), t.buffer],
            t.void,
            {
                hasUserData: true,
                userDataIndex: 2,
                scope: "async",
                ...(explicit ? { userDataArgIndex: 2 } : {}),
            },
        );
        const create = t.fn("libgio-2.0.so.0", "g_simple_async_result_new_error", {
            args: [
                { type: t.struct() },
                { type: callback },
                { type: t.uint32 },
                { type: t.int32 },
                { type: t.string() },
                { type: t.int32 },
                { type: t.float64 },
            ],
            returns: t.struct("full", {
                sharedLibrary: "libgobject-2.0.so.0",
                freeFnName: "g_object_unref",
                wrapperClass: AsyncResult,
            }),
            fixedArgCount: 5,
        });
        const complete = t.bind("libgio-2.0.so.0", "g_simple_async_result_complete", [t.struct()], t.void);
        const errorType = t.struct("full", { sharedLibrary: "libglib-2.0.so.0", freeFnName: "g_error_free" });
        const propagate = t.bind(
            "libgio-2.0.so.0",
            "g_simple_async_result_propagate_error",
            [t.struct(), t.ref(errorType)],
            t.boolean,
        );
        const quark = t.bind("libglib-2.0.so.0", "g_quark_from_string", [t.string()], t.uint32);
        const messages: unknown[] = [];
        const result = create(
            null,
            (_source: unknown, completed: AsyncResult) => {
                const error: { value: ExternalObject<Handle> | null } = { value: null };
                if (propagate(getHandle(completed), error) && error.value !== null) {
                    messages.push(read(error.value, t.string(), 8));
                }
            },
            quark("gtkx-runtime-variadic-callback"),
            1,
            "%d:%.2f",
            7,
            12.75,
        );

        expect(messages).toEqual([]);
        expect(result).toBeInstanceOf(AsyncResult);
        if (result instanceof AsyncResult) {
            complete(getHandle(result));
        }
        expect(messages).toEqual(["7:12.75"]);
    },
);

test.each([
    { fixedArgCount: 1, userDataArgIndex: 2, hasDestroy: false },
    { fixedArgCount: 1, userDataArgIndex: 0, hasDestroy: false },
    { fixedArgCount: 1, destroyArgIndex: 3, hasDestroy: true },
    { fixedArgCount: 1, destroyArgIndex: 0, hasDestroy: true },
])("callback arguments cannot cross the variadic boundary: %j", ({ fixedArgCount, ...options }) => {
    const callback = t.callback([t.buffer], t.void, { ...options, hasUserData: true, userDataIndex: 0 });
    const movesIntoFixed = options.userDataArgIndex === 0 || options.destroyArgIndex === 0;
    const descriptors = movesIntoFixed ? [t.int32, callback] : [callback, t.int32];

    expect(() =>
        t.fn("libgtkx-missing.so", "missing", {
            args: descriptors.map((type) => ({ type })),
            returns: t.void,
            fixedArgCount,
        }),
    ).toThrow(/callback.*fixed\/variadic boundary/i);
});

test.each([
    { fixedArgCount: 2, userDataArgIndex: 0 },
    { fixedArgCount: 1, userDataArgIndex: 1 },
])("callback arguments can reorder within the same variadic region: %j", ({ fixedArgCount, userDataArgIndex }) => {
    const callback = t.callback([t.buffer], t.void, { hasUserData: true, userDataIndex: 0, userDataArgIndex });

    expect(() =>
        t.fn("libgtkx-missing.so", "missing", {
            args: [{ type: t.int32 }, { type: callback }, { type: t.int32 }],
            returns: t.void,
            fixedArgCount,
        }),
    ).not.toThrow();
});
