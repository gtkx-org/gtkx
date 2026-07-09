import { tryGetHandle } from "./registry.js";

const attachCreationStack = (error: unknown, creationStack: Error | undefined): void => {
    if (creationStack === undefined || !(error instanceof Error)) return;
    if (error.cause !== undefined || !Object.isExtensible(error)) return;
    error.cause = creationStack;
};

export const promisify = <R extends object, T>(
    asyncFn: (...args: unknown[]) => void,
    finish: (result: R) => T,
    cancellable: object | null | undefined,
    ...leading: unknown[]
): Promise<T> =>
    new Promise<T>((resolve, reject) => {
        let creationStack: Error | undefined;
        if (process.env.NODE_ENV !== "production") {
            creationStack = new Error("gtkx async operation started here");
            Error.captureStackTrace(creationStack, promisify);
        }
        asyncFn(...leading, tryGetHandle(cancellable), (_source: object | null, asyncResult: object) => {
            try {
                resolve(finish(asyncResult as R));
            } catch (error) {
                attachCreationStack(error, creationStack);
                reject(error);
            }
        });
    });
