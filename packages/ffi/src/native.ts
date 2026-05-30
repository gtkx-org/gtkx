/**
 * Native error handling and the consolidated FFI helper re-export.
 *
 * Re-exports the `@gtkx/native` primitives and the `t` binding/type helpers
 * from `./helpers.js` under a single specifier hand-written bindings import
 * from, and defines the error-domain machinery that generated throwing
 * callables use to surface `GError` failures as `instanceof`-discriminable
 * thrown values.
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
 * Throws the failing `GError` when a `GError` out-parameter holds an error.
 *
 * Generated bindings for throwing callables pass the populated error ref and
 * the GLib `Error` wrapper class. The raw `GError` wrapper is thrown directly,
 * so the catch site reads its `domain`, `code`, and `message` off the live
 * boxed value and discriminates it with `instanceof` against a generated
 * error-domain enum. A JavaScript stack trace pointing at the call site is
 * attached before throwing so failures remain debuggable even though the
 * boxed `GError` is not a JavaScript `Error`. A no-op when the ref is empty.
 *
 * @param error - Out-parameter ref populated by the FFI call
 * @param errorClass - The GLib `Error` wrapper class
 */
export function checkError(error: Ref<NativeHandle | null>, errorClass: NativeClass<GError>): void {
    if (error.value !== null) {
        const gerror = getNativeObject(error.value, errorClass);
        const carrier = new Error(gerror.message);
        Error.captureStackTrace?.(carrier, checkError);
        Object.defineProperty(gerror, "stack", {
            value: carrier.stack,
            configurable: true,
            writable: true,
        });
        throw gerror;
    }
}

const isGError = (value: unknown): value is GError =>
    typeof value === "object" && value !== null && "domain" in value && typeof value.domain === "number";

/**
 * An error-domain enum: a frozen member map that also acts as the right-hand
 * side of an `instanceof` check.
 *
 * `error instanceof SomeErrorDomain` is true when `error` is a `GError` thrown
 * from the matching GLib error domain, letting callers discriminate failures
 * without referencing the GLib `Error` class.
 *
 * @typeParam T - The enum's member-name to numeric-value map.
 */
export type ErrorDomain<T extends Record<string, number>> = Readonly<T> & {
    readonly [Symbol.hasInstance]: (value: unknown) => value is GError;
};

/**
 * Builds an error-domain enum whose `instanceof` checks match `GError`s thrown
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
    const hasInstance = (value: unknown): value is GError => {
        domain ??= resolveDomain();
        return isGError(value) && value.domain === domain;
    };
    const enumObject: Record<string, unknown> = { ...members };
    Object.defineProperty(enumObject, Symbol.hasInstance, { value: hasInstance });
    return Object.freeze(enumObject) as ErrorDomain<T>;
}
