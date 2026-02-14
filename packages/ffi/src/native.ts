import {
    type Arg,
    alloc as nativeAlloc,
    beginBatch as nativeBeginBatch,
    call as nativeCall,
    endBatch as nativeEndBatch,
    read as nativeRead,
    readPointer as nativeReadPointer,
    write as nativeWrite,
    writePointer as nativeWritePointer,
    type Type,
} from "@gtkx/native";
import type { GError } from "./generated/glib/error.js";
import { typeCheckInstanceIsA, typeFromName } from "./generated/gobject/functions.js";
import { TypeInstance } from "./generated/gobject/type-instance.js";
import { isStarted } from "./lifecycle.js";
import type { NativeClass, NativeObject } from "./object.js";

export type { NativeHandle } from "./object.js";
export { type NativeClass, NativeObject } from "./object.js";

/**
 * Error class wrapping GLib GError structures.
 *
 * Provides access to the error domain, code, and message from
 * native GTK/GLib errors.
 *
 * @example
 * ```tsx
 * try {
 *   file.loadContents();
 * } catch (error) {
 *   if (error instanceof NativeError) {
 *     console.log(`GLib error ${error.domain}:${error.code}: ${error.message}`);
 *   }
 * }
 * ```
 */
export class NativeError extends Error {
    readonly gerror: GError;

    getDomain(): number {
        return this.gerror.getDomain();
    }

    getCode(): number {
        return this.gerror.getCode();
    }

    /**
     * Creates a NativeError from a GError instance.
     *
     * @param gerror - GError wrapper instance
     */
    constructor(gerror: GError) {
        super(gerror.getMessage() ?? "Unknown error");

        this.gerror = gerror;
        this.name = "NativeError";

        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, NativeError);
        }
    }
}

/**
 * Gets a native object as a specific interface type if it implements that interface.
 *
 * Uses GLib's type system to check if the object implements the specified
 * interface, and returns a wrapped instance if it does.
 *
 * @typeParam T - The interface type
 * @param obj - The native object to check
 * @param iface - The interface class (must have a glibTypeName property)
 * @returns The wrapped interface instance, or null if not implemented
 *
 * @example
 * ```tsx
 * const editable = getNativeInterface(widget, Gtk.Editable);
 * if (editable) {
 *     const text = editable.getText();
 * }
 * ```
 */
export function getNativeInterface<T extends NativeObject>(obj: NativeObject, iface: NativeClass<T>): T | null {
    if (!obj.handle) return null;

    const glibTypeName = iface.glibTypeName;
    if (!glibTypeName) return null;

    const gtype = typeFromName(glibTypeName);
    if (gtype === 0) return null;

    const typeInstance = Object.create(TypeInstance.prototype) as TypeInstance;
    typeInstance.handle = obj.handle;

    if (!typeCheckInstanceIsA(typeInstance, gtype)) {
        return null;
    }

    const instance = Object.create(iface.prototype) as T;
    instance.handle = obj.handle;
    return instance;
}

const ensureIsStarted = (detail?: string) => {
    if (!isStarted()) {
        throw new Error(
            `GTK runtime not started. Call start() before making FFI calls. ${detail ? ` (${detail})` : ""}`,
        );
    }
};

/**
 * Invokes a native function through FFI.
 *
 * @param library - Library name (e.g., "gtk", "adw")
 * @param symbol - Function symbol name
 * @param args - Arguments with type information for marshaling
 * @param returnType - Expected return type descriptor
 * @returns The unmarshaled return value
 * @throws If runtime not started or undefined required argument
 */
export const call = (library: string, symbol: string, args: Arg[], returnType: Type): unknown => {
    ensureIsStarted(`attempted call: ${library}:${symbol}`);
    return nativeCall(library, symbol, args, returnType);
};

/**
 * Allocates native memory for a structure or buffer.
 *
 * @param size - Number of bytes to allocate
 * @param typeName - Optional type name for debugging
 * @param library - Optional library name for debugging
 * @returns Handle to the allocated memory
 * @throws If runtime not started
 */
export const alloc = (size: number, typeName?: string, library?: string): unknown => {
    ensureIsStarted(`attempted alloc: ${library ?? "unknown"}:${typeName ?? "unknown"}`);
    return nativeAlloc(size, typeName, library);
};

/**
 * Reads a value from native memory.
 *
 * @param handle - Handle to the memory region
 * @param type - Type descriptor for unmarshaling
 * @param offset - Byte offset within the memory region
 * @returns The unmarshaled value
 * @throws If runtime not started
 */
export const read = (handle: unknown, type: Type, offset: number): unknown => {
    ensureIsStarted("attempted read");
    return nativeRead(handle, type, offset);
};

/**
 * Reads a value through a pointer in native memory.
 *
 * @param handle - Handle to the memory region containing the pointer
 * @param ptrOffset - Byte offset to the pointer within handle
 * @param elementOffset - Byte offset from the dereferenced pointer
 * @returns Handle to the dereferenced memory location
 * @throws If runtime not started
 */
export const readPointer = (handle: unknown, ptrOffset: number, elementOffset: number): unknown => {
    ensureIsStarted("attempted readPointer");
    return nativeReadPointer(handle, ptrOffset, elementOffset);
};

/**
 * Writes a value to native memory.
 *
 * @param handle - Handle to the memory region
 * @param type - Type descriptor for marshaling
 * @param offset - Byte offset within the memory region
 * @param value - Value to write
 * @throws If runtime not started
 */
export const write = (handle: unknown, type: Type, offset: number, value: unknown): void => {
    ensureIsStarted("attempted write");
    nativeWrite(handle, type, offset, value);
};

/**
 * Writes data through a pointer in native memory.
 *
 * @param destHandle - Handle to the destination memory region
 * @param ptrOffset - Byte offset to the pointer within destHandle
 * @param elementOffset - Byte offset from the dereferenced pointer
 * @param sourceHandle - Handle to the source data
 * @param size - Number of bytes to copy
 * @throws If runtime not started
 */
export const writePointer = (
    destHandle: unknown,
    ptrOffset: number,
    elementOffset: number,
    sourceHandle: unknown,
    size: number,
): void => {
    ensureIsStarted("attempted writePointer");
    nativeWritePointer(destHandle, ptrOffset, elementOffset, sourceHandle, size);
};

export const beginBatch = (): void => {
    ensureIsStarted("attempted beginBatch");
    nativeBeginBatch();
};

export const endBatch = (): void => {
    nativeEndBatch();
};
