import { createRequire } from "node:module";
import type { Arg, Ref, Type } from "./types.js";

const require = createRequire(import.meta.url);
const native = require("./index.node");

/**
 * Creates a reference wrapper for out/inout parameters in FFI calls.
 * @param value - The initial value to wrap
 * @returns A reference object whose value property can be mutated by native calls
 */
export function createRef<T>(value: T): Ref<T> {
    return { value };
}

/**
 * Calls a native GTK function via FFI.
 * @param library - The shared library name (e.g., "libgtk-4.so.1")
 * @param symbol - The C function symbol name to call
 * @param args - Array of argument descriptors with types and values
 * @param returnType - Type descriptor for the return value
 * @returns The return value from the native function
 */
export function call(library: string, symbol: string, args: Arg[], returnType: Type): unknown {
    return native.call(library, symbol, args, returnType);
}

/**
 * Descriptor for a batched FFI call.
 */
export type CallDescriptor = {
    library: string;
    symbol: string;
    args: Arg[];
};

/**
 * Executes multiple void FFI calls in a single native dispatch.
 * @param calls - Array of call descriptors to execute
 */
export function batchCall(calls: CallDescriptor[]): void {
    native.batchCall(calls);
}

/**
 * Starts the GTK application main loop.
 * @param appId - The application ID (e.g., "com.example.myapp")
 * @param flags - Optional GIO application flags
 * @returns The GTK Application instance pointer
 */
export function start(appId: string, flags?: number): unknown {
    return native.start(appId, flags);
}

/**
 * Stops the GTK application and exits the main loop.
 */
export function stop(): void {
    native.stop();
}

/**
 * Reads a field from a boxed record at the specified offset.
 * @param objectId - The boxed object pointer
 * @param type - Type descriptor for the field
 * @param offset - Memory offset in bytes from the start of the struct
 * @returns The field value
 */
export function read(objectId: unknown, type: Type, offset: number): unknown {
    return native.read(objectId, type, offset);
}

/**
 * Writes a value to a field in a boxed record at the specified offset.
 * @param objectId - The boxed object pointer
 * @param type - Type descriptor for the field
 * @param offset - Memory offset in bytes from the start of the struct
 * @param value - The value to write
 */
export function write(objectId: unknown, type: Type, offset: number, value: unknown): void {
    native.write(objectId, type, offset, value);
}

/**
 * Allocates a zeroed struct of the specified size and registers it as a boxed type.
 * @param size - Size of the struct in bytes
 * @param glibTypeName - The GLib type name (e.g., "GdkRGBA")
 * @param lib - Optional library name to look up the type registration function
 * @returns The allocated boxed object pointer
 */
export function alloc(size: number, glibTypeName: string, lib?: string): unknown {
    return native.alloc(size, glibTypeName, lib);
}

/**
 * Gets the unique identifier for a GObject/boxed pointer.
 * This returns a unique identifier for the underlying native object,
 * which can be used as a Map key to track objects across signal callbacks.
 * @param id - The object pointer from an FFI call or signal callback
 * @returns The native object identifier as a number
 */
export function getObjectId(id: unknown): number {
    return native.getObjectId(id);
}

/**
 * Processes pending JS callbacks from GTK signals.
 * This is a workaround for runtimes like Deno where Neon's channel wake-up
 * mechanism may not work correctly. Call this periodically to ensure
 * callbacks are processed even when the event loop isn't being woken up.
 */
export function poll(): void {
    native.poll();
}

export type { Ref, Arg, Type };
