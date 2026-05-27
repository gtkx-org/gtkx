/**
 * Coerces an unknown thrown value into a human-readable string.
 *
 * Returns `error.message` when `error` is an `Error` instance, otherwise
 * delegates to `String(error)`. Use at boundaries where exceptions are
 * surfaced to logs, IPC frames, or user-facing output and the type cannot
 * be narrowed otherwise.
 *
 * @param error - The caught value of unknown shape.
 * @returns A string describing the error.
 */
export const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));
