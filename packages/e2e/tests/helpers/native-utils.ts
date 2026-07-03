import { bind, type Descriptor, type ExternalObject, type Handle, call as nativeCall, read } from "@gtkx/native";

export function callArgs(
    sharedLibrary: string,
    symbol: string,
    args: { type: Descriptor; value: unknown }[],
    returnDescriptor: Descriptor,
): unknown {
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

const UINT32_DESCRIPTOR: Descriptor = { kind: "uint32" };

export function getRefCount(handle: ExternalObject<Handle>): number {
    return read(handle, UINT32_DESCRIPTOR, GOBJECT_REF_COUNT_OFFSET) as number;
}
