import { isErrorLike } from "./error-like.ts";
import { errorMessage } from "./error-message.ts";

function normalizeError(error: unknown): Error {
    if (Error.isError(error) || error instanceof Error) {
        return error;
    }

    return Object.assign(new Error(errorMessage(error)), isErrorLike(error) ? error : {});
}

export { normalizeError };
