import type { NativeObject } from "./base.js";

export interface GErrorLike extends NativeObject {
    readonly domain: number;
    readonly code: number;
    readonly message: string;
}

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

    get id(): unknown {
        return this.gerror.id;
    }

    get domain(): number {
        return this.gerror.domain;
    }

    get code(): number {
        return this.gerror.code;
    }

    /**
     * Creates a NativeError from a GError instance.
     *
     * @param gerror - GError wrapper instance
     */
    constructor(gerror: GErrorLike) {
        super(gerror.message ?? "Unknown error");

        this.gerror = gerror;
        this.name = "NativeError";

        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, NativeError);
        }
    }
}
