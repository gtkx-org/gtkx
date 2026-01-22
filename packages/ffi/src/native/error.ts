import type { NativeObject } from "./base.js";

/**
 * Interface representing a GLib GError structure.
 *
 * Contains the error domain, code, and message from native GTK/GLib errors.
 */
export type GErrorLike = NativeObject & {
    /** The error domain (quark identifying the error source) */
    getDomain(): number;
    /** The error code within the domain */
    getCode(): number;
    /** Human-readable error message */
    getMessage(): string;
};

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
    readonly gerror: GErrorLike;

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
    constructor(gerror: GErrorLike) {
        super(gerror.getMessage() ?? "Unknown error");

        this.gerror = gerror;
        this.name = "NativeError";

        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, NativeError);
        }
    }
}
