import { alloc, type ExternalObject, type Handle, read, t, write } from "@gtkx/runtime";
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
