import { isErrorLike } from "./error-like.ts";

function errorMessage(error: unknown): string {
    return Error.isError(error) || isErrorLike(error) ? error.message : String(error);
}

export { errorMessage };
