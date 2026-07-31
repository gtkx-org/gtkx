import { isErrorLike } from "./error-like.ts";

/**
 * Extracts a human-readable message from an unknown thrown value, falling back to its string form.
 *
 * @param error - The caught value to describe.
 * @returns The value's message when it has one, otherwise its string form.
 *
 * @example
 * errorMessage(new Error("boom")); // "boom"
 * errorMessage(42); // "42"
 */
function errorMessage(error: unknown): string {
    return Error.isError(error) || isErrorLike(error) ? error.message : String(error);
}

export { errorMessage };
