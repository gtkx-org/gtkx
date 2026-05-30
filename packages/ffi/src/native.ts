/**
 * Native error handling and the consolidated FFI helper re-export.
 *
 * Re-exports the `@gtkx/native` primitives and the `t` binding/type helpers
 * from `./helpers.js` under a single specifier hand-written bindings import
 * from, and defines the `NativeError` class and error-domain machinery that
 * generated throwing callables use to surface `GError` failures as
 * `instanceof`-discriminable JavaScript errors.
 */

export type { ArrayKind, ArrayOptions, Ownership, TrampolineOptions, TrampolineScope } from "./helpers.js";
export { alloc, call, freeze, getNativeId, read, t, unfreeze, write } from "./helpers.js";

import type { NativeHandle, Ref } from "@gtkx/native";
import type { Error as GError } from "./generated/glib/glib.js";
import type { NativeClass } from "./handles.js";
import { getNativeObject } from "./registry.js";

export type { NativeHandle, Type } from "@gtkx/native";
export { findObjectProperty, getInstanceGType } from "@gtkx/native";
export type { NativeClass } from "./handles.js";

/**
 * Error thrown by generated bindings when a throwing GTK/GLib callable fails.
 *
 * Carries the failing `GError`'s domain quark and code. Discriminate it at the
 * catch site with `instanceof` against a generated error-domain enum rather
 * than referencing this class directly.
 */
export class NativeError extends Error {
    /** Quark of the GLib error domain the failure belongs to. */
    readonly domain: number;
    /** Domain-specific error code. */
    readonly code: number;

    /**
     * @param gerror - The populated `GError` wrapper from a throwing callable.
     */
    constructor(gerror: GError) {
        super(gerror.message ?? "Unknown error");

        this.name = "NativeError";
        this.domain = gerror.domain;
        this.code = gerror.code;

        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, NativeError);
        }
    }
}

/**
 * Throws a {@link NativeError} when a `GError` out-parameter holds an error.
 *
 * Generated bindings for throwing callables pass the populated error ref and
 * the GLib `Error` wrapper class. A no-op when the ref is empty.
 *
 * @param error - Out-parameter ref populated by the FFI call
 * @param errorClass - The GLib `Error` wrapper class
 */
export function checkError(error: Ref<NativeHandle | null>, errorClass: NativeClass<GError>): void {
    if (error.value !== null) {
        throw new NativeError(getNativeObject(error.value, errorClass));
    }
}

/**
 * An error-domain enum: a frozen member map that also acts as the right-hand
 * side of an `instanceof` check.
 *
 * `error instanceof SomeErrorDomain` is true when `error` was thrown from the
 * matching GLib error domain, letting callers discriminate failures without
 * referencing the internal error class.
 *
 * @typeParam T - The enum's member-name to numeric-value map.
 */
export type ErrorDomain<T extends Record<string, number>> = Readonly<T> & {
    readonly [Symbol.hasInstance]: (
        value: unknown,
    ) => value is Error & { readonly domain: number; readonly code: number };
};

/**
 * Builds an error-domain enum whose `instanceof` checks match errors thrown
 * from the given GLib error domain.
 *
 * The domain quark is resolved lazily on first `instanceof` check, since the
 * generated `quark_from_string` binding may be declared after the enum in its
 * module.
 *
 * @param resolveDomain - Resolves the quark of the GLib error domain.
 * @param members - The enum's member-name to numeric-value map.
 * @returns A frozen enum object usable as an `instanceof` right-hand side.
 */
export function makeErrorDomain<const T extends Record<string, number>>(
    resolveDomain: () => number,
    members: T,
): ErrorDomain<T> {
    let domain: number | undefined;
    const hasInstance = (value: unknown): boolean => {
        domain ??= resolveDomain();
        return value instanceof NativeError && value.domain === domain;
    };
    const enumObject: Record<string, unknown> = { ...members };
    Object.defineProperty(enumObject, Symbol.hasInstance, { value: hasInstance });
    return Object.freeze(enumObject) as ErrorDomain<T>;
}
