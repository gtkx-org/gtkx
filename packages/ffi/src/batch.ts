import { type Arg, batchCall, type CallDescriptor, call as nativeCall, type Type } from "@gtkx/native";

const batchStack: CallDescriptor[][] = [];

/**
 * Begins a new FFI call batch.
 *
 * Batching queues multiple FFI calls and executes them together in a single
 * native round-trip, reducing overhead. Batches can be nested.
 *
 * @example
 * ```tsx
 * beginBatch();
 * widget.setVisible(true);
 * widget.setSensitive(true);
 * endBatch(); // Executes both calls in one FFI round-trip
 * ```
 *
 * @see {@link endBatch} for executing batched calls
 * @see {@link batch} for a convenient wrapper
 */
export const beginBatch = (): void => {
    batchStack.push([]);
};

/**
 * Checks if currently inside a batch context.
 *
 * @returns `true` if {@link beginBatch} was called without a matching {@link endBatch}
 */
export const isBatching = (): boolean => {
    return batchStack.length > 0;
};

/**
 * Ends the current batch and executes all queued FFI calls.
 *
 * Must be paired with a preceding {@link beginBatch} call.
 *
 * @see {@link beginBatch} for starting a batch
 * @see {@link batch} for a convenient wrapper
 */
export const endBatch = (): void => {
    const queue = batchStack.pop();
    if (!queue) return;

    if (queue.length > 0) {
        batchCall(queue);
    }
};

/**
 * Discards all pending batched calls without executing them.
 *
 * Used for error recovery when batched operations should be abandoned.
 */
export const discardAllBatches = (): void => {
    batchStack.length = 0;
};

/**
 * Makes an FFI call, batching it if inside a batch context.
 *
 * Calls with void return type are queued for batching. Calls with return
 * values are executed immediately since the result is needed.
 *
 * @param library - Shared library name (e.g., "libgtk-4.so.1")
 * @param symbol - Function symbol name
 * @param args - Function arguments
 * @param returnType - Expected return type
 * @returns The function return value, or undefined for void calls
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
 * Executes a function with automatic batching.
 *
 * Wraps the function in {@link beginBatch}/{@link endBatch} calls.
 *
 * @param fn - Function to execute with batching
 * @returns The function's return value
 *
 * @example
 * ```tsx
 * batch(() => {
 *   widget.setVisible(true);
 *   widget.setSensitive(true);
 *   widget.setCssClasses(["active"]);
 * });
 * ```
 */
export const batch = <T extends (...args: unknown[]) => unknown>(fn: T): ReturnType<T> => {
    beginBatch();

    try {
        return fn() as ReturnType<T>;
    } finally {
        endBatch();
    }
};
