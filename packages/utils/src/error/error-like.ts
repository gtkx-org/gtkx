import { isRecord } from "../predicate/is-record.ts";

function isErrorLike(value: unknown): value is { message: string } {
    return isRecord(value) && "message" in value && typeof value.message === "string";
}

function readStream(value: unknown): string {
    if (typeof value === "string") {
        return value;
    }

    if (value instanceof Uint8Array || Buffer.isBuffer(value)) {
        return value.toString();
    }

    return "";
}

export { isErrorLike, readStream };
