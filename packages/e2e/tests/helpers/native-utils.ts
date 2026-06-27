import type { Descriptor, Handle, Value } from "@gtkx/native";
import { bind, call as nativeCall, read } from "@gtkx/native";

/**
 * Test convenience over the bound FFI call: binds a one-shot descriptor from the per-argument types
 * and invokes it with the values, so tests can pass `{ type, value }` arguments directly.
 */
export function callArgs(
    sharedLibrary: string,
    symbol: string,
    args: { type: Descriptor; value: Value }[],
    returnDescriptor: Descriptor,
): Value {
    const descriptor = bind(
        sharedLibrary,
        symbol,
        args.map((arg) => arg.type),
        returnDescriptor,
    );
    return nativeCall(
        descriptor,
        args.map((arg) => arg.value),
    );
}

const GOBJECT_REF_COUNT_OFFSET = 8;

export const GTK_LIB = "libgtk-4.so.1";
export const GOBJECT_LIB = "libgobject-2.0.so.0";
export const BIGUINT64 = { kind: "biguint64" as const };

const STRING_BORROWED = { kind: "string" as const, ownership: "borrowed" as const };

export const typeFromName = (name: string): bigint =>
    callArgs(GOBJECT_LIB, "g_type_from_name", [{ type: STRING_BORROWED, value: name }], BIGUINT64) as bigint;

export function forceGC(): void {
    if (!global.gc) {
        throw new Error("global.gc is not available. Run tests with --expose-gc flag.");
    }
    global.gc();
}

export function getRefCount(handle: Handle): number {
    return read(handle, { kind: "uint32" }, GOBJECT_REF_COUNT_OFFSET) as number;
}
