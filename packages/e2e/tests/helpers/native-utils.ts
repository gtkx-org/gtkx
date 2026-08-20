import { bind, type Descriptor, type ExternalObject, type Handle, call as nativeCall, read } from "@gtkx/native";

const GOBJECT_REF_COUNT_OFFSET = 8;
const GOBJECT_LIB = "libgobject-2.0.so.0";
const BIGUINT64 = { kind: "biguint64" as const };
const STRING_BORROWED = { kind: "string" as const, ownership: "borrowed" as const };
const UINT32_DESCRIPTOR: Descriptor = { kind: "uint32" };

function callArgs(
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

const typeFromName = (name: string): bigint =>
    callArgs(GOBJECT_LIB, "g_type_from_name", [{ type: STRING_BORROWED, value: name }], BIGUINT64) as bigint;

function forceGC(): void {
    if (!globalThis.gc) {
        throw new Error("global.gc is not available. Run tests with --expose-gc flag.");
    }

    globalThis.gc();
}

async function gcUntil(isSatisfied: () => boolean, maxRounds = 100): Promise<void> {
    for (let round = 0; round < maxRounds; round++) {
        if (isSatisfied()) {
            return;
        }

        await new Promise((resolve) => setImmediate(resolve));
        forceGC();
        await new Promise((resolve) => setImmediate(resolve));
    }
}

function getRefCount(handle: ExternalObject<Handle>): number {
    return read(handle, UINT32_DESCRIPTOR, GOBJECT_REF_COUNT_OFFSET) as number;
}

export { BIGUINT64, callArgs, gcUntil, getRefCount, GOBJECT_LIB, typeFromName };
