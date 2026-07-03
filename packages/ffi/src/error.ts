import type { ExternalObject, Handle, Ref } from "@gtkx/native";
import { getWrapperClass, wrapHandle } from "./registry.js";
import { getErrorType, isTypedClass } from "./type.js";

type ErrorLike = {
    domain: number;
    code: number;
    message: string;
};

export type ErrorDomain<T extends Record<string, number>> = T & {
    [Symbol.hasInstance]: (value: unknown) => value is ErrorLike;
};

export function checkError(error: Ref): void {
    if (error.value !== null) {
        const gerror = wrapHandle<ErrorLike>(error.value as ExternalObject<Handle>, getWrapperClass(getErrorType()));
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

const isError = (value: unknown): value is ErrorLike => isTypedClass(value) && value.__type__ === getErrorType();

export function createErrorDomain<const T extends Record<string, number>>(
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
