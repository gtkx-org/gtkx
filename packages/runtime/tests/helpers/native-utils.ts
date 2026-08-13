import { bind, type Descriptor, call as nativeCall } from "@gtkx/native";

// eslint-disable-next-line gtkx/no-library-prefix
const GTK_LIB = "libgtk-4.so.1";
const GOBJECT_LIB = "libgobject-2.0.so.0";
const BIGUINT64 = { kind: "biguint64" as const };

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

export { BIGUINT64, callArgs, forceGC, gcUntil, GOBJECT_LIB, GTK_LIB };
