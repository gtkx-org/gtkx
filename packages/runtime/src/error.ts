import type { ExternalObject, Handle, Ref } from "@gtkx/native";
import { getWrapperClass, wrapHandle } from "./registry.js";
import { getErrorType, isTypedClass } from "./type.js";

type ErrorLike = Error & {
    domain: number;
    code: number;
};

/**
 * An error enum object carrying its member codes plus an `instanceof` check that
 * matches wrapped GLib errors belonging to a specific error domain.
 */
type ErrorDomain<T extends Record<string, number>> = T & {
    [Symbol.hasInstance]: (value: unknown) => value is ErrorLike;
};

function checkError(error: Ref): void {
    if (error.value === null) {
        return;
    }

    const gerror = wrapHandle(error.value as ExternalObject<Handle>, getWrapperClass(getErrorType())) as ErrorLike;
    const callSite = new Error("gtkx call site");
    const callerFrames = (callSite.stack ?? "").split("\n").slice(2);
    gerror.stack = [`${gerror.name}: ${gerror.message}`, ...callerFrames].join("\n");
    throw gerror;
}

const isError = (value: unknown): value is ErrorLike => isTypedClass(value) && value.__type__ === getErrorType();

/**
 * Builds an error domain enum object from its members and a lazy resolver for the
 * domain quark, giving it an `instanceof` check that matches wrapped GLib errors of
 * that domain.
 *
 * @param resolveDomain Called once, on first `instanceof` check, to obtain the domain quark.
 * @param members The error code enum members to expose on the returned object.
 */
function createErrorDomain<const T extends Record<string, number>>(
    resolveDomain: () => number,
    members: T,
): ErrorDomain<T> {
    let domain: number | undefined;

    const hasInstance = (value: unknown): value is ErrorLike => {
        domain ??= resolveDomain();

        return isError(value) && value.domain === domain;
    };

    const enumObject: Record<string, unknown> = { ...members };
    Object.defineProperty(enumObject, Symbol.hasInstance, { value: hasInstance });

    return enumObject as ErrorDomain<T>;
}

export { checkError, createErrorDomain, type ErrorDomain };
