/**
 * Re-export the helpers FIRST so that ES modules visit `./helpers.js`
 * before the generated-code imports below. Generated bindings call `t.fn(...)`
 * at module load time, which would hit a TDZ error if `helpers.js` were
 * evaluated after the generated modules in our import-graph cycle.
 */

export type { ArrayKind, ArrayOptions, Ownership, TrampolineOptions, TrampolineScope } from "./helpers.js";
export { alloc, call, freeze, read, t, unfreeze, write } from "./helpers.js";

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
