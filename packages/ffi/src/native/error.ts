import { read } from "@gtkx/native";

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
    /** Native error pointer */
    readonly id: unknown;

    /** GLib error domain (quark) */
    readonly domain: number;

    /** Error code within the domain */
    readonly code: number;

    /**
     * Creates a NativeError from a GError pointer.
     *
     * @param id - Native GError pointer
     */
    constructor(id: unknown) {
        const message = read(id, { type: "string" }, 8) as string;
        super(message ?? "Unknown error");

        this.id = id;
        this.domain = read(id, { type: "int", size: 32, unsigned: true }, 0) as number;
        this.code = read(id, { type: "int", size: 32, unsigned: false }, 4) as number;

        this.name = "NativeError";

        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, NativeError);
        }
    }
}
