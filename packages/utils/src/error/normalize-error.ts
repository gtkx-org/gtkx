import { isErrorLike } from "./error-like.ts";
import { errorMessage } from "./error-message.ts";

/**
 * Coerces an unknown thrown value into an `Error`, reusing it when it already is one and otherwise
 * wrapping its message while copying any error-like own properties.
 *
 * @param error - The caught value to normalize.
 * @returns The value itself when it is an `Error`, otherwise a new `Error` carrying its message.
 *
 * @example
 * normalizeError("boom"); // Error: boom
 */
function normalizeError(error: unknown): Error {
    if (Error.isError(error)) {
        return error;
    }

    return Object.assign(new Error(errorMessage(error)), isErrorLike(error) ? error : {});
}

export { normalizeError };
