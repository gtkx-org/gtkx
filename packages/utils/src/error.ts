import { types } from "node:util";

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const isErrorLike = (value: unknown): value is { message: string } =>
    isObject(value) && "message" in value && typeof value["message"] === "string";

export const errorMessage = (error: unknown): string =>
    types.isNativeError(error) || isErrorLike(error) ? error.message : String(error);

export const normalizeError = (error: unknown): Error => {
    if (types.isNativeError(error)) return error;
    return Object.assign(new Error(errorMessage(error)), isErrorLike(error) ? error : {});
};

const readStream = (value: unknown): string => {
    if (typeof value === "string") return value;
    if (value instanceof Uint8Array || Buffer.isBuffer(value)) return value.toString();
    return "";
};

export const formatChildProcessError = (error: unknown): string | undefined => {
    if (!isObject(error)) return undefined;
    const { stderr, stdout } = error;
    const details = [readStream(stderr), readStream(stdout)].filter(Boolean).join("\n").trim();
    return details.length > 0 ? details : undefined;
};
