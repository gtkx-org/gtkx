import { createRequire } from "node:module";
import { arch, platform } from "node:os";
import type { Arg, CallbackType, FfiValue, NativeHandle, Ref, Type } from "./types.js";

const require = createRequire(import.meta.url);

function loadNativeBinding() {
    const currentPlatform = platform();
    const currentArch = arch();

    if (currentPlatform !== "linux") {
        throw new Error(`Unsupported platform: ${currentPlatform}. Only Linux is supported.`);
    }

    if (currentArch !== "x64" && currentArch !== "arm64") {
        throw new Error(`Unsupported architecture: ${currentArch}. Only x64 and arm64 are supported.`);
    }

    const packageName = `@gtkx/native-linux-${currentArch}`;

    try {
        return require(packageName);
    } catch (error) {
        const originalError = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to load native binding for ${currentPlatform}-${currentArch}: ${originalError}`);
    }
}

const native = loadNativeBinding();

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
 * Gets the internal handle ID for a native pointer.
 *
 * Used for comparing object identity.
 *
 * @param handle - Native handle
 * @returns Internal handle ID
 */
export function getNativeId(handle: NativeHandle): number {
    return native.getNativeId(handle);
}

export function freeze(): void {
    native.freeze();
}

export function unfreeze(): void {
    native.unfreeze();
}

export type { Arg, CallbackType, FfiValue, NativeHandle, Ref, Type };
