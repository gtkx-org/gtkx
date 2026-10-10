import {
    alloc,
    type ExternalObject,
    fromNative,
    getHandle,
    type Handle,
    read,
    setHandle,
    t,
    write,
} from "@gtkx/runtime";
import { expect, test } from "vitest";

class Variant {}

const library = "libglib-2.0.so.0";
const variant = t.fundamental(library, "g_variant_ref", "g_variant_unref", { wrapperClass: Variant });
const ownedVariant = t.fundamental(library, "g_variant_ref", "g_variant_unref", {
    ownership: "full",
    wrapperClass: Variant,
});
const borrowedVariant = t.fundamental(library, "", "", { wrapperClass: Variant });
const newInt32 = t.bind(library, "g_variant_new_int32", [t.int32], ownedVariant);
const ref = t.bind(library, "g_variant_ref", [variant], ownedVariant);
const getInt32 = t.bind(library, "g_variant_get_int32", [variant], t.int32);

const createHandle = (value: number): ExternalObject<Handle> => newInt32(value) as ExternalObject<Handle>;
const wrap = (handle: unknown): Variant => fromNative(variant, handle) as Variant;
const settle = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

async function collect(): Promise<void> {
    if (globalThis.gc === undefined) {
        throw new Error("Fundamental identity tests require --expose-gc");
    }

    await settle();
    globalThis.gc();
}

test("independently acquired fundamental handles reuse the live wrapper", () => {
    const handle = createHandle(42);
    const first = wrap(handle);

    expect(first).toBeInstanceOf(Variant);
    expect(wrap(handle)).toBe(first);
    expect(wrap(ref(handle))).toBe(first);
    expect(wrap(createHandle(42))).not.toBe(first);
    expect(getInt32(getHandle(first))).toBe(42);
});

test("borrowed fundamental handles reuse owned wrappers without populating the cache", () => {
    const handle = createHandle(17);
    const storage = alloc(8);
    write(storage, variant, 0, handle);
    const borrowed = read(storage, borrowedVariant, 0);
    const firstBorrow = wrap(borrowed);

    expect(wrap(borrowed)).not.toBe(firstBorrow);
    expect(getInt32(getHandle(firstBorrow))).toBe(17);

    const owned = wrap(handle);

    expect(owned).not.toBe(firstBorrow);
    expect(wrap(borrowed)).toBe(owned);
    expect(wrap(read(storage, borrowedVariant, 0))).toBe(owned);
});

test("replacing a wrapper handle removes its old fundamental identity", () => {
    const firstHandle = createHandle(11);
    const secondHandle = createHandle(22);
    const first = wrap(firstHandle);
    setHandle(first, firstHandle);
    expect(wrap(firstHandle)).toBe(first);

    setHandle(first, secondHandle);
    const replacement = wrap(firstHandle);

    expect(replacement).not.toBe(first);
    expect(wrap(firstHandle)).toBe(replacement);
    expect(getInt32(getHandle(first))).toBe(22);
    expect(getInt32(getHandle(replacement))).toBe(11);
});

test("a collected wrapper can be replaced before its finalizer runs", async () => {
    const handle = createHandle(73);
    const weak = new WeakRef(wrap(handle));

    for (let round = 0; round < 30 && weak.deref() !== undefined; round++) {
        await collect();
    }

    expect(weak.deref()).toBeUndefined();
    const replacement = wrap(handle);
    expect(wrap(ref(handle))).toBe(replacement);

    for (let round = 0; round < 3; round++) {
        await collect();
        await settle();
    }

    expect(wrap(handle)).toBe(replacement);
    expect(getInt32(getHandle(replacement))).toBe(73);
});

test("non-fundamental handles never acquire a fundamental wrapper identity", () => {
    const handle = alloc(8);

    expect(wrap(handle)).not.toBe(wrap(handle));
});
