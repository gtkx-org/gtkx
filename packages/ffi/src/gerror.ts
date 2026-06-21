import type { Handle, Ref } from "@gtkx/native";
import { getErrorGtype, isGtyped } from "./gtype.js";
import { requireWrapperClassByGtype, wrapHandle } from "./registry.js";

export interface GError {
    domain: number;
    code: number;
    message: string;
}

export function checkError(error: Ref): void {
    if (error.value !== null) {
        const gerror = wrapHandle<GError>(error.value as Handle, requireWrapperClassByGtype(getErrorGtype()));
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

const isGError = (value: unknown): value is GError => isGtyped(value) && value.__gtype__ === getErrorGtype();

export type ErrorDomain<T extends Record<string, number>> = T & {
    [Symbol.hasInstance]: (value: unknown) => value is GError;
};

export function createErrorDomain<const T extends Record<string, number>>(
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
