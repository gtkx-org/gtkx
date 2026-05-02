/**
 * FFI Type Writer
 *
 * Builds FFI type descriptor POJOs for code generation.
 * Callers serialize descriptors with JSON.stringify().
 */

import type { FfiTypeDescriptor } from "../type-system/ffi-types.js";

/**
 * Options for the FFI type writer.
 */
type FfiTypeWriterOptions = {
    /** Current shared library for boxed types without explicit lib */
    currentSharedLibrary?: string;
    /** GLib shared library for GError types (derived from GIR) */
    glibLibrary?: string;
};

/**
 * Builds FFI type descriptor POJOs.
 *
 * This is the single source of truth for generating type descriptor objects.
 * Callers use `JSON.stringify()` to serialize the descriptors into generated code.
 *
 * @example
 * ```typescript
 * const writer = new FfiTypeWriter({ currentSharedLibrary: "libgtk-4.so.1" });
 * const descriptor = writer.createSelfTypeDescriptor({ isRecord: true, recordName: "GtkTextIter" });
 * console.log(JSON.stringify(descriptor)); // { type: "boxed", ownership: "borrowed", ... }
 * ```
 */
export class FfiTypeWriter {
    private readonly options: FfiTypeWriterOptions;

    constructor(options: FfiTypeWriterOptions = {}) {
        this.options = options;
    }

    /**
     * Sets the current shared library for boxed types.
     */
    setSharedLibrary(lib: string): void {
        this.options.currentSharedLibrary = lib;
    }

    /**
     * Creates a GError ref type descriptor for error out parameters.
     * Requires glibLibrary to be set in options.
     */
    createGErrorRefTypeDescriptor(): FfiTypeDescriptor {
        if (!this.options.glibLibrary) {
            throw new Error("glibLibrary must be set in FfiTypeWriterOptions for GError types");
        }
        return {
            type: "ref",
            innerType: {
                type: "boxed",
                ownership: "full",
                innerType: "GError",
                library: this.options.glibLibrary,
                getTypeFn: "g_error_get_type",
            },
        };
    }

    /**
     * Builds a self argument type descriptor as a POJO.
     */
    createSelfTypeDescriptor(options: {
        isRecord?: boolean;
        recordName?: string;
        sharedLibrary?: string;
        getTypeFn?: string;
        isFundamental?: boolean;
        fundamentalLib?: string;
        fundamentalRefFunc?: string;
        fundamentalUnrefFunc?: string;
        fundamentalTypeName?: string;
    }): FfiTypeDescriptor {
        if (options.isRecord && options.recordName) {
            const lib = options.sharedLibrary ?? this.options.currentSharedLibrary ?? "";
            const obj: FfiTypeDescriptor = {
                type: "boxed",
                ownership: "borrowed",
                innerType: options.recordName,
                library: lib,
            };
            if (options.getTypeFn) {
                obj.getTypeFn = options.getTypeFn;
            }
            return obj;
        }
        if (
            options.isFundamental &&
            options.fundamentalLib &&
            options.fundamentalRefFunc &&
            options.fundamentalUnrefFunc
        ) {
            const obj: FfiTypeDescriptor = {
                type: "fundamental",
                ownership: "borrowed",
                library: options.fundamentalLib,
                refFn: options.fundamentalRefFunc,
                unrefFn: options.fundamentalUnrefFunc,
            };
            if (options.fundamentalTypeName) {
                obj.typeName = options.fundamentalTypeName;
            }
            return obj;
        }
        return { type: "gobject", ownership: "borrowed" };
    }
}
