import type { NativeHandle } from "@gtkx/native";
import {
    type Arg,
    alloc as nativeAlloc,
    call as nativeCall,
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

/**
 * Base class for all GTK/GLib object wrappers.
 *
 * Provides common functionality for native object representation including
 * type metadata and equality comparison.
 *
 * @see {@link getNativeObject} for creating wrapper instances
 */
export abstract class NativeObject {
    /** The GLib type name (e.g., "GtkButton", "AdwHeaderBar") */
    static readonly glibTypeName: string;

    /** The type category: gobject, interface, boxed, struct, or fundamental */
    static readonly objectType: "gobject" | "interface" | "boxed" | "struct" | "fundamental";

    /** The underlying native handle */
    handle: NativeHandle;

    // biome-ignore lint/suspicious/noExplicitAny: Required for NativeClass type compatibility
    constructor(..._args: any[]) {
        this.handle = undefined as unknown as NativeHandle;
    }
}

/**
 * Constructor type for native object wrapper classes.
 *
 * @typeParam T - The wrapped object type
 */
// biome-ignore lint/suspicious/noExplicitAny: Required for contravariant behavior
export type NativeClass<T extends NativeObject = NativeObject> = typeof NativeObject & (new (...args: any[]) => T);

export type { NativeHandle };

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
    ensureIsStarted(`attempted read: ${handle} at offset ${offset}`);
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
    ensureIsStarted(`attempted readPointer: ${handle} at offset ${ptrOffset}+${elementOffset}`);
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
    ensureIsStarted(`attempted write: ${handle} at offset ${offset}`);
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
    ensureIsStarted(`attempted writePointer: ${destHandle} at offset ${ptrOffset}+${elementOffset}`);
    nativeWritePointer(destHandle, ptrOffset, elementOffset, sourceHandle, size);
};
