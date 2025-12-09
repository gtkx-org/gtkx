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
export const call = native.call as (library: string, symbol: string, args: Arg[], returnType: Type) => unknown;

/**
 * Starts the GTK application main loop.
 * @param appId - The application ID (e.g., "com.example.myapp")
 * @param flags - Optional GIO application flags
 * @returns The GTK Application instance pointer
 */
export const start = native.start as (appId: string, flags?: number) => unknown;

/**
 * Stops the GTK application and exits the main loop.
 */
export const stop = native.stop as () => void;

/**
 * Reads a field from a boxed record at the specified offset.
 * @param objectId - The boxed object pointer
 * @param type - Type descriptor for the field
 * @param offset - Memory offset in bytes from the start of the struct
 * @returns The field value
 */
export const read = native.read as (objectId: unknown, type: Type, offset: number) => unknown;

/**
 * Writes a value to a field in a boxed record at the specified offset.
 * @param objectId - The boxed object pointer
 * @param type - Type descriptor for the field
 * @param offset - Memory offset in bytes from the start of the struct
 * @param value - The value to write
 */
export const write = native.write as (objectId: unknown, type: Type, offset: number, value: unknown) => void;

/**
 * Allocates a zeroed struct of the specified size and registers it as a boxed type.
 * @param size - Size of the struct in bytes
 * @param glibTypeName - The GLib type name (e.g., "GdkRGBA")
 * @param lib - Optional library name to look up the type registration function
 * @returns The allocated boxed object pointer
 */
export const alloc = native.alloc as (size: number, glibTypeName: string, lib?: string) => unknown;

/**
 * Gets a stable numeric ID for a GObject/boxed pointer.
 * This returns the raw memory address of the underlying native object,
 * which can be used as a Map key to track objects across signal callbacks.
 * @param objectId - The object pointer from an FFI call or signal callback
 * @returns The native pointer address as a number
 */
export function getObjectId(objectId: unknown): number {
    return native.getObjectId(objectId);
}

export type { Ref, Arg, Type };
