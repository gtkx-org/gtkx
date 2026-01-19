import { createRequire } from "node:module";
import { arch, platform } from "node:os";
import type { Arg, CallbackType, NativeHandle, Ref, Type } from "./types.js";

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
 * @param handle - Native handle pointing to the memory
 * @param type - Type of value to read
 * @param offset - Byte offset from the handle pointer
 * @returns The read value
 */
export function read(handle: unknown, type: Type, offset: number): unknown {
    return native.read(handle, type, offset);
}

/**
 * Writes a value to native memory.
 *
 * @param handle - Native handle pointing to the memory
 * @param type - Type of value to write
 * @param offset - Byte offset from the handle pointer
 * @param value - Value to write
 */
export function write(handle: unknown, type: Type, offset: number, value: unknown): void {
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
export function alloc(size: number, glibTypeName?: string, lib?: string): unknown {
    return native.alloc(size, glibTypeName, lib);
}

/**
 * Gets the internal handle ID for a native pointer.
 *
 * Used for comparing object identity.
 *
 * @param handle - Native handle
 * @returns Internal handle ID
 */
export function getNativeId(handle: unknown): number {
    return native.getNativeId(handle);
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

/**
 * Creates a view into a parent struct's memory at a given offset.
 *
 * Used for accessing nested structs within a parent struct. The returned
 * handle shares memory ownership with the parent via Arc reference counting.
 *
 * @param handle - Native handle pointing to the parent struct (must be Struct or View type)
 * @param offset - Byte offset from the parent's base pointer
 * @returns Native handle pointing to the view location
 */
export function readView(handle: unknown, offset: number): unknown {
    return native.readView(handle, offset);
}

/**
 * Creates a view into pointed array memory at a given element index.
 *
 * Used for accessing elements of arrays pointed to by struct fields.
 * The array pointer is read from the parent at ptrOffset, then the view
 * is created at the calculated element offset.
 *
 * @param handle - Native handle pointing to the parent struct
 * @param ptrOffset - Byte offset of the pointer field in the parent
 * @param elementIndex - Index of the element to access
 * @param elementSize - Size of each element in bytes
 * @returns Native handle pointing to the array element
 */
export function readPointerView(
    handle: unknown,
    ptrOffset: number,
    elementIndex: number,
    elementSize: number,
): unknown {
    return native.readPointerView(handle, ptrOffset, elementIndex, elementSize);
}

export type { NativeHandle, Ref, Arg, Type, CallbackType };
