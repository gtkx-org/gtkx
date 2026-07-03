import { tryGetHandle } from "./registry.js";

const attachCreationStack = (error: unknown, creationStack: Error | undefined): void => {
    if (creationStack === undefined || !(error instanceof Error)) return;
    if (error.cause !== undefined || !Object.isExtensible(error)) return;
    error.cause = creationStack;
};

export const promisify = (
    asyncFn: (...args: unknown[]) => void,
    finish: (result: object) => unknown,
    cancellable: object | null | undefined,
    ...leading: unknown[]
): Promise<unknown> =>
    new Promise((resolve, reject) => {
        let creationStack: Error | undefined;
        if (process.env.NODE_ENV !== "production") {
            creationStack = new Error("gtkx async operation started here");
            Error.captureStackTrace(creationStack, promisify);
        }
        asyncFn(...leading, tryGetHandle(cancellable), (_source: object | null, asyncResult: object) => {
            try {
                resolve(finish(asyncResult));
            } catch (error) {
                attachCreationStack(error, creationStack);
                reject(error);
            }
        });
    });
