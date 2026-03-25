import {
    type Arg,
    type FfiValue,
    type NativeHandle,
    alloc as nativeAlloc,
    call as nativeCall,
    freeze as nativeFreeze,
    read as nativeRead,
    unfreeze as nativeUnfreeze,
    write as nativeWrite,
    type Type,
} from "@gtkx/native";
import type { GError } from "./generated/glib/error.js";
import { typeCheckInstanceIsA, typeFromName } from "./generated/gobject/functions.js";
import { TypeInstance } from "./generated/gobject/type-instance.js";
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
        return this.gerror.domain;
    }

    getCode(): number {
        return this.gerror.code;
    }

    /**
     * Creates a NativeError from a GError instance.
     *
     * @param gerror - GError wrapper instance
     */
    constructor(gerror: GError) {
        super(gerror.message ?? "Unknown error");

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
export const call = (library: string, symbol: string, args: Arg[], returnType: Type): FfiValue => {
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
export const alloc = (size: number, typeName?: string, library?: string): NativeHandle => {
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
export const read = (handle: NativeHandle, type: Type, offset: number): FfiValue => {
    return nativeRead(handle, type, offset);
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
export const write = (handle: NativeHandle, type: Type, offset: number, value: unknown): void => {
    nativeWrite(handle, type, offset, value);
};

/**
 * Freezes the GLib main loop, preventing it from processing events.
 *
 * While frozen, GTK property changes and signal emissions are batched
 * and deferred until {@link unfreeze} is called. This is used internally
 * by the reconciler to group multiple mutations into a single
 * main-loop iteration, avoiding intermediate redraws.
 */
export const freeze = (): void => {
    nativeFreeze();
};

/**
 * Unfreezes the GLib main loop, flushing all batched mutations.
 *
 * Must be paired with a preceding {@link freeze} call. Once unfrozen,
 * all deferred property changes and signal emissions are dispatched
 * in a single main-loop iteration.
 */
export const unfreeze = (): void => {
    nativeUnfreeze();
};
