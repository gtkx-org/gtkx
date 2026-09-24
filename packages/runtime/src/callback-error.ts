import { type CallbackFailure, type ExternalObject, type Handle, resolveType } from "@gtkx/native";
import type { ErrorLike } from "./error.js";
import { bind } from "./bind.js";
import { boxedT, int32T, stringT, uint32T } from "./descriptors.js";
import { LIB } from "./library.js";

const cache: { newError?: ReturnType<typeof bind>; quark?: number; errorType?: bigint } = {};

const isError = (value: unknown): value is ErrorLike =>
    typeof value === "object" && value !== null && "__type__" in value &&
    value.__type__ === (cache.errorType ??= resolveType(LIB, "g_error_get_type"));

class CallbackError extends Error implements CallbackFailure {
    readonly nativeError: ExternalObject<Handle>;
    readonly thrown: unknown;

    constructor(nativeError: ExternalObject<Handle>, thrown: unknown) {
        super();
        this.nativeError = nativeError;
        this.thrown = thrown;
    }
}

const objectMessage = (thrown: object): string => {
    const message: unknown = Reflect.get(thrown, "message");

    return typeof message === "string" && message !== "" ? message : "JavaScript exception";
};

const errorMessage = (thrown: unknown): string => {
    if (typeof thrown === "string") {
        return thrown;
    }

    return typeof thrown === "object" && thrown !== null ? objectMessage(thrown) : "JavaScript exception";
};

const callbackFailure = (thrown: unknown): CallbackError => {
    const isWrapped = isError(thrown);
    let domain: number;
    if (isWrapped) {
        domain = thrown.domain;
    } else {
        cache.quark ??= bind(LIB, "g_quark_from_string", [stringT("borrowed")], uint32T)(
            "gtkx-js-error-quark",
        ) as number;
        domain = cache.quark;
    }
    const code = isWrapped ? thrown.code : 0;
    const message = isWrapped ? thrown.message : errorMessage(thrown);
    cache.newError ??= bind(LIB, "g_error_new_literal", [uint32T, int32T, stringT("borrowed")], boxedT("GError", {
        ownership: "full",
        sharedLibrary: LIB,
        getTypeFnName: "g_error_get_type",
    }));
    const nativeError = cache.newError(domain, code, message.replaceAll("\0", "�"));

    return new CallbackError(nativeError as ExternalObject<Handle>, thrown);
};

export { callbackFailure, isError };
