import { createRequire } from "node:module";
import type { Arg, Ref, Type } from "./types.js";

const require = createRequire(import.meta.url);
const native = require("./index.node");

/**
 * Creates a mutable reference wrapper.
 *
 * Used for out-parameters in FFI calls where the native function
 * needs to write a value back.
 *
 * @typeParam T - The type of the referenced value
 * @param value - Initial value
 * @returns A reference object containing the value
 *
 * @example
 * ```tsx
 * const errorRef = createRef<GError | null>(null);
 * const result = someFunction(errorRef);
 * if (errorRef.value) {
 *   console.error(errorRef.value.message);
 * }
 * ```
 */
export function createRef<T>(value: T): Ref<T> {
    return { value };
}

/**
 * Makes a low-level FFI call to a native library.
 *
 * This is the core FFI mechanism. Most code should use the generated
 * bindings in `@gtkx/ffi` instead of calling this directly.
 *
 * @param library - Shared library name (e.g., "libgtk-4.so.1")
 * @param symbol - Function symbol name
 * @param args - Function arguments with type information
 * @param returnType - Expected return type
 * @returns The function return value
 */
export function call(library: string, symbol: string, args: Arg[], returnType: Type): unknown {
    return native.call(library, symbol, args, returnType);
}

/**
 * Descriptor for a batched FFI call.
 */
export type CallDescriptor = {
    /** Shared library name */
    library: string;
    /** Function symbol name */
    symbol: string;
    /** Function arguments */
    args: Arg[];
};

/**
 * Executes multiple FFI calls in a single native round-trip.
 *
 * Improves performance by reducing FFI overhead for multiple
 * void-returning calls.
 *
 * @param calls - Array of call descriptors to execute
 */
export function batchCall(calls: CallDescriptor[]): void {
    native.batchCall(calls);
}

/**
 * Starts the GTK runtime and creates an application.
 *
 * @param appId - Application ID in reverse domain notation
 * @param flags - Optional GIO application flags
 * @returns Native application pointer
 *
 * @internal Use `@gtkx/ffi` start() instead
 */
export function start(appId: string, flags?: number): unknown {
    return native.start(appId, flags);
}

/**
 * Stops the GTK runtime.
 *
 * @internal Use `@gtkx/ffi` stop() instead
 */
export function stop(): void {
    native.stop();
}

/**
 * Reads a value from native memory.
 *
 * @param objectId - Native object pointer
 * @param type - Type of value to read
 * @param offset - Byte offset from the object pointer
 * @returns The read value
 */
export function read(objectId: unknown, type: Type, offset: number): unknown {
    return native.read(objectId, type, offset);
}

/**
 * Writes a value to native memory.
 *
 * @param objectId - Native object pointer
 * @param type - Type of value to write
 * @param offset - Byte offset from the object pointer
 * @param value - Value to write
 */
export function write(objectId: unknown, type: Type, offset: number, value: unknown): void {
    native.write(objectId, type, offset, value);
}

/**
 * Allocates memory for a boxed type.
 *
 * @param size - Size in bytes to allocate
 * @param glibTypeName - GLib type name for the boxed type
 * @param lib - Optional library containing the type
 * @returns Native pointer to allocated memory
 */
export function alloc(size: number, glibTypeName: string, lib?: string): unknown {
    return native.alloc(size, glibTypeName, lib);
}

/**
 * Gets the internal object ID for a native pointer.
 *
 * Used for comparing object identity.
 *
 * @param id - Native object pointer
 * @returns Internal object ID
 */
export function getObjectId(id: unknown): number {
    return native.getObjectId(id);
}

/**
 * Processes pending GTK events.
 *
 * Called automatically in the event loop. Only needed for
 * special runtime environments (e.g., Deno).
 */
export function poll(): void {
    native.poll();
}

export type { Ref, Arg, Type };
