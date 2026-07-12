const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const isErrorLike = (value: unknown): value is { message: string } =>
    isObject(value) && "message" in value && typeof value.message === "string";

/**
 * Extracts a human-readable message from an unknown thrown value, falling back to its string form.
 *
 * @param error The caught value to describe.
 */
export const errorMessage = (error: unknown): string =>
    Error.isError(error) || isErrorLike(error) ? error.message : String(error);

/**
 * Coerces an unknown thrown value into an `Error`, reusing it if it already is one and otherwise
 * wrapping its message while copying any error-like own properties.
 *
 * @param error The caught value to normalize.
 */
export const normalizeError = (error: unknown): Error => {
    if (Error.isError(error)) return error;
    return Object.assign(new Error(errorMessage(error)), isErrorLike(error) ? error : {});
};

const readStream = (value: unknown): string => {
    if (typeof value === "string") return value;
    if (value instanceof Uint8Array || Buffer.isBuffer(value)) return value.toString();
    return "";
};

/**
 * Combines the `stderr` and `stdout` fields of a failed child-process error into a single trimmed string.
 *
 * @param error The child-process error to read output from.
 * @returns The joined output, or `undefined` when neither stream carried any text.
 */
export const formatChildProcessError = (error: unknown): string | undefined => {
    if (!isObject(error)) return undefined;
    const { stderr, stdout } = error;
    const details = [readStream(stderr), readStream(stdout)].filter(Boolean).join("\n").trim();
    return details.length > 0 ? details : undefined;
};
