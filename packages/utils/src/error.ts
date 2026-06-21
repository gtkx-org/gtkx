import { types } from "node:util";

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const isErrorLike = (value: unknown): value is { message: string } =>
    isObject(value) && "message" in value && typeof value["message"] === "string";

/**
 * Extracts a human-readable message from an unknown throw value.
 *
 * Returns the `message` of a native `Error` (detected realm-safely via
 * `node:util` `types.isNativeError`) or of any error-like object, falling back
 * to `String(error)` for everything else. This avoids leaking `"[object Object]"`
 * to users and agents when an error-like object is thrown.
 *
 * @param error - the unknown throw value
 * @returns the extracted message string
 */
export const errorMessage = (error: unknown): string =>
    types.isNativeError(error) || isErrorLike(error) ? error.message : String(error);

/**
 * Normalizes an unknown throw value into a genuine `Error`.
 *
 * Native errors are returned unchanged so their stack is preserved. Error-like
 * objects are wrapped in a new `Error` whose own enumerable properties (such as
 * `code` or `errno`) are copied across; all other values become an `Error`
 * carrying their {@link errorMessage}. Intended as the canonical catch-block
 * primitive for code that must hold an `Error`.
 *
 * @param error - the unknown throw value
 * @returns a genuine `Error`, with error-like properties preserved when present
 */
export const normalizeError = (error: unknown): Error => {
    if (types.isNativeError(error)) return error;
    return Object.assign(new Error(errorMessage(error)), isErrorLike(error) ? error : {});
};

const readStream = (value: unknown): string => {
    if (typeof value === "string") return value;
    if (value instanceof Uint8Array || Buffer.isBuffer(value)) return value.toString();
    return "";
};

/**
 * Formats the combined stderr/stdout of a child-process error into a message.
 *
 * Reads the `stderr` and `stdout` streams (string or `Buffer`/`Uint8Array`) of
 * an error-like value, joins the non-empty parts with a newline, and trims the
 * result. Returns `undefined` when the value is not an object or carries no
 * stream output.
 *
 * @param error - the unknown throw value, typically a spawned-process error
 * @returns the combined, trimmed stream output, or `undefined` when there is none
 */
export const formatChildProcessError = (error: unknown): string | undefined => {
    if (!isObject(error)) return undefined;
    const { stderr, stdout } = error;
    const details = [readStream(stderr), readStream(stdout)].filter(Boolean).join("\n").trim();
    return details.length > 0 ? details : undefined;
};
