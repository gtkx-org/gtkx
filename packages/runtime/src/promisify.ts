import { tryGetHandle } from "./registry.js";

const attachCreationStack = (error: unknown, creationStack: Error | undefined): void => {
    if (creationStack === undefined || !(error instanceof Error)) return;
    if (error.cause !== undefined || !Object.isExtensible(error)) return;
    error.cause = creationStack;
};

/**
 * Extracts the finished value from the async result a GIO-style operation completes with.
 *
 * @template R - The async result type passed to the completion callback.
 * @template T - The finished value type.
 */
export type FinishResult<R extends object, T> = (result: R) => T;

/**
 * Wraps a GIO-style asynchronous function that takes a completion callback into a
 * promise, invoking the finish function to extract the result. Outside production,
 * the call site's stack is captured and attached as the rejection error's cause.
 *
 * @param asyncFn The async function, called with the leading arguments, the cancellable, and a completion callback.
 * @param finish Extracts the result from the async result passed to the completion callback.
 * @param cancellable A cancellable object, or null/undefined for none.
 * @param leading Arguments passed to `asyncFn` before the cancellable and callback.
 * @returns A promise resolving to the finished result, or rejecting if `finish` throws.
 */
export const promisify = <R extends object, T>(
    asyncFn: (...args: unknown[]) => void,
    finish: FinishResult<R, T>,
    cancellable: object | null | undefined,
    ...leading: unknown[]
): Promise<T> =>
    new Promise<T>((resolve, reject) => {
        const creationStack =
            process.env.NODE_ENV === "production" ? undefined : new Error("gtkx async operation started here");
        asyncFn(...leading, tryGetHandle(cancellable), (_source: object | null, asyncResult: object) => {
            try {
                resolve(finish(asyncResult as R));
            } catch (error_) {
                attachCreationStack(error_, creationStack);
                reject(error_ instanceof Error ? error_ : new Error(String(error_)));
            }
        });
    });
