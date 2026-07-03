import { tryGetHandle } from "./registry.js";

type AsyncStartFn = (...args: unknown[]) => void;
type AsyncFinishFn = (result: object) => unknown;

const attachCreationSite = (error: unknown, creationSite: Error | undefined): void => {
    if (creationSite === undefined || !(error instanceof Error)) return;
    if (error.cause !== undefined || !Object.isExtensible(error)) return;
    error.cause = creationSite;
};

export const promisify = (
    asyncFn: AsyncStartFn,
    finish: AsyncFinishFn,
    cancellable: object | null | undefined,
    ...leading: unknown[]
): Promise<unknown> =>
    new Promise((resolve, reject) => {
        let creationSite: Error | undefined;
        if (process.env.NODE_ENV !== "production") {
            creationSite = new Error("gtkx async operation started here");
            Error.captureStackTrace(creationSite, promisify);
        }
        asyncFn(...leading, tryGetHandle(cancellable), (_source: object | null, asyncResult: object) => {
            try {
                resolve(finish(asyncResult));
            } catch (error) {
                attachCreationSite(error, creationSite);
                reject(error);
            }
        });
    });
