import { type Arg, batchCall, type CallDescriptor, call as nativeCall, type Type } from "@gtkx/native";

const batchStack: CallDescriptor[][] = [];

/**
 * Begins batching mode for FFI calls.
 * Batching is nestable - each beginBatch pushes a new queue onto the stack.
 * While in batch mode, void calls are queued instead of executed immediately.
 */
export const beginBatch = (): void => {
    batchStack.push([]);
};

/**
 * Checks if batching mode is currently active.
 * @returns true if batching is active, false otherwise
 */
export const isBatching = (): boolean => {
    return batchStack.length > 0;
};

/**
 * Ends the current batch level and executes its queued FFI calls.
 * If nested inside another batch, the calls are executed immediately
 * rather than being merged into the parent batch.
 */
export const endBatch = (): void => {
    const queue = batchStack.pop();
    if (!queue) return;

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
    const currentQueue = batchStack[batchStack.length - 1];

    if (currentQueue && returnType.type === "undefined") {
        currentQueue.push({ library, symbol, args });
        return undefined;
    }

    return nativeCall(library, symbol, args, returnType);
};

/**
 * Executes a function within its own batch scope.
 * Since batching is nestable, this creates a new batch level that executes
 * immediately when the function completes, regardless of any outer batch.
 * Use this for operations that must execute synchronously.
 * @param fn - The function to execute within a batch scope
 */
export const batch = <T extends (...args: unknown[]) => unknown>(fn: T): ReturnType<T> => {
    beginBatch();

    try {
        return fn() as ReturnType<T>;
    } finally {
        endBatch();
    }
};
