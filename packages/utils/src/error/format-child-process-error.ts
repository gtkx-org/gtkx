import { isRecord } from "../predicate/is-record.ts";
import { readStream } from "./error-like.ts";

function formatChildProcessError(error: unknown): string | undefined {
    if (!isRecord(error)) {
        return undefined;
    }

    const { stderr, stdout } = error;
    const details = [readStream(stderr), readStream(stdout)].filter(Boolean).join("\n").trim();

    return details.length > 0 ? details : undefined;
}

export { formatChildProcessError };
