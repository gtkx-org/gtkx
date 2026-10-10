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

test("callbacks with a destroy notifier infer a retained lifetime", async () => {
    const callback = t.callback([t.buffer], t.boolean, { hasUserData: true, hasDestroy: true, userDataIndex: 0 });
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
