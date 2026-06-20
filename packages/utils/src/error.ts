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

const readStream = (value: unknown): string => {
    if (typeof value === "string") return value;
    if (value instanceof Uint8Array || Buffer.isBuffer(value)) return value.toString();
    return "";
};

/**
 * Extracts the combined `stderr`/`stdout` of a failed child-process invocation
 * into one trimmed diagnostic string, or `undefined` when neither stream
 * carries output. Each stream may be a string or a `Buffer`. Use to attach the
 * tool's own message to a wrapping `Error` so the failure is actionable.
 *
 * @param error - The value thrown by `execFileSync`/`execSync`.
 * @returns The combined output, trimmed, or `undefined` when empty.
 */
export const formatChildProcessError = (error: unknown): string | undefined => {
    if (typeof error !== "object" || error === null) return undefined;
    const { stderr, stdout } = error as { stderr?: unknown; stdout?: unknown };
    const details = [readStream(stderr), readStream(stdout)].filter(Boolean).join("\n").trim();
    return details.length > 0 ? details : undefined;
};
