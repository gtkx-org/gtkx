import { isRecord } from "../predicate/is-record.ts";
import { readStream } from "./error-like.ts";

/**
 * Combines the `stderr` and `stdout` of a failed child-process error into a single trimmed string.
 *
 * @param error - The child-process error to read output from.
 * @returns The joined output, or `undefined` when neither stream carried any text.
 *
 * @example
 * formatChildProcessError({ stderr: "boom" }); // "boom"
 */
function formatChildProcessError(error: unknown): string | undefined {
    if (!isRecord(error)) {
        return undefined;
    }

    const { stderr, stdout } = error;
    const details = [readStream(stderr), readStream(stdout)].filter(Boolean).join("\n").trim();

    return details.length > 0 ? details : undefined;
}

export { formatChildProcessError };
