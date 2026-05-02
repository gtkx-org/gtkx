import * as nativeBinding from "./native-binding.cjs";
import type { Arg, FfiValue, NativeHandle, Ref, Type } from "./types.js";

const native = nativeBinding as unknown as {
    alloc: (size: number, typeName?: string, lib?: string) => NativeHandle;
    call: (library: string, symbol: string, args: unknown[], returnType: unknown) => unknown;
    freeze: () => void;
    getNativeId: (handle: NativeHandle) => number;
    isNativeHandle: (value: unknown) => boolean;
    read: (handle: NativeHandle, type: unknown, offset: number) => unknown;
    start: (appId: string, flags?: number) => NativeHandle;
    stop: () => void;
    unfreeze: () => void;
    write: (handle: NativeHandle, type: unknown, offset: number, value: unknown) => unknown;
};

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
    return { value } as Ref<T>;
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
export function call(library: string, symbol: string, args: Arg[], returnType: Type): FfiValue {
    return native.call(library, symbol, args, returnType) as FfiValue;
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
export function start(appId: string, flags?: number): NativeHandle {
    return native.start(appId, flags) as NativeHandle;
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
 * @param handle - Native handle pointing to the memory
 * @param type - Type of value to read
 * @param offset - Byte offset from the handle pointer
 * @returns The read value
 */
export function read(handle: NativeHandle, type: Type, offset: number): FfiValue {
    return native.read(handle, type, offset) as FfiValue;
}

/**
 * Writes a value to native memory.
 *
 * @param handle - Native handle pointing to the memory
 * @param type - Type of value to write
 * @param offset - Byte offset from the handle pointer
 * @param value - Value to write
 */
export function write(handle: NativeHandle, type: Type, offset: number, value: unknown): void {
    native.write(handle, type, offset, value);
}

/**
 * Allocates memory for a boxed type or plain struct.
 *
 * @param size - Size in bytes to allocate
 * @param glibTypeName - GLib type name for boxed types (optional for plain structs)
 * @param lib - Optional library containing the type
 * @returns Native pointer to allocated memory
 */
export function alloc(size: number, glibTypeName?: string, lib?: string): NativeHandle {
    return native.alloc(size, glibTypeName, lib) as NativeHandle;
}

/**
 * Returns the underlying native pointer as a number.
 *
 * The number is the memory address of the wrapped GObject / Boxed /
 * Fundamental instance, suitable for object-identity comparisons in
 * JavaScript. Two handles referring to the same native object always
 * return the same value.
 *
 * @param handle - Native handle
 * @returns The native pointer value as a number
 */
export function getNativeId(handle: NativeHandle): number {
    return native.getNativeId(handle);
}

/**
 * Checks whether a value is a native handle owned by this module.
 *
 * Verifies both that the value is a napi External and that it carries the
 * GTKX-native handle sentinel, so externals from other native addons return
 * `false`.
 *
 * @param value - Any JavaScript value
 * @returns `true` if `value` is a `NativeHandle` produced by this module
 */
export function isNativeHandle(value: unknown): value is NativeHandle {
    return native.isNativeHandle(value);
}

/**
 * Suspends GTK frame-clock dispatch while a batch of mutations is applied.
 *
 * Bracketed by [[unfreeze]] to release the GLib main loop. Calls nest: only
 * the outermost `freeze` / `unfreeze` pair starts and stops the freeze loop.
 *
 * @internal Used by `@gtkx/react` around React commits.
 */
export function freeze(): void {
    native.freeze();
}

/**
 * Resumes normal GTK frame-clock dispatch after a [[freeze]] block.
 *
 * @internal Used by `@gtkx/react` around React commits.
 */
export function unfreeze(): void {
    native.unfreeze();
}

export type { Arg, CallbackType, FfiValue, NativeHandle, Ref, Type } from "./types.js";
