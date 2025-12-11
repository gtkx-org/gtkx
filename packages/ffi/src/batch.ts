import { type Arg, batchCall, type CallDescriptor, call as nativeCall, type Type } from "@gtkx/native";

let batchQueue: CallDescriptor[] | null = null;

/**
 * Begins batching mode for FFI calls.
 * While in batch mode, void calls are queued instead of executed immediately.
 */
export const beginBatch = (): void => {
    batchQueue = [];
};

/**
 * Checks if batching mode is currently active.
 * @returns true if batching is active, false otherwise
 */
export const isBatching = (): boolean => {
    return batchQueue !== null;
};

/**
 * Executes all queued FFI calls in a single native dispatch and ends batching mode.
 * The queue is cleared before execution so that any calls made during
 * signal handlers (which fire during batch processing) execute immediately
 * rather than being queued and lost.
 */
export const endBatch = (): void => {
    if (!batchQueue) return;

    const queue = batchQueue;
    batchQueue = null;

    if (queue.length > 0) {
        batchCall(queue);
    }
};

/**
 * Calls a native GTK function via FFI.
 * When batching is active and the return type is void, the call is queued
 * for batch execution instead of being executed immediately.
 * @param library - The shared library name (e.g., "libgtk-4.so.1")
 * @param symbol - The C function symbol name to call
 * @param args - Array of argument descriptors with types and values
 * @param returnType - Type descriptor for the return value
 * @returns The return value from the native function
 */
export const call = (library: string, symbol: string, args: Arg[], returnType: Type): unknown => {
    if (batchQueue !== null && returnType.type === "undefined") {
        batchQueue.push({ library, symbol, args });
        return undefined;
    }

    return nativeCall(library, symbol, args, returnType);
};
