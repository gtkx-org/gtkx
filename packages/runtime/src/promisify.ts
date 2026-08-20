import { getHandle } from "./registry.js";

/**
 * Extracts the value of a completed asynchronous operation from its `GAsyncResult`, throwing when
 * the operation failed.
 */
type FinishResult<R extends object, T> = (result: R) => T;

type Settlement<R extends object, T> = {
    finish: FinishResult<R, T>;
    creationStack: Error | undefined;
    resolve: (value: T) => void;
    reject: (reason: Error) => void;
};

/** A finish result with its leading success boolean dropped: bare when one value remains, a tuple otherwise. */
type TrimmedFinish<T> = T extends readonly [boolean, infer Only]
    ? Only
    : T extends readonly [boolean, ...infer Rest]
        ? Rest
        : never;

const attachCreationStack = (error: unknown, creationStack: Error | undefined): void => {
    if (creationStack === undefined || !(error instanceof Error)) {
        return;
    }

    if (error.cause !== undefined || !Object.isExtensible(error)) {
        return;
    }

    error.cause = creationStack;
};

const settle = <R extends object, T>(settlement: Settlement<R, T>, asyncResult: object): void => {
    const { finish, creationStack, resolve, reject } = settlement;

    try {
        resolve(finish(asyncResult as R));
    } catch (error) {
        attachCreationStack(error, creationStack);
        reject(error instanceof Error ? error : new Error(String(error)));
    }
};

/**
 * Wraps a finish function whose result leads with the success boolean of a throwing C call,
 * dropping that boolean: failure already surfaces as a thrown error, so the boolean is always
 * `true`. A single remaining value is handed back bare, several stay a tuple. The finish result
 * must carry at least one value beyond the boolean; a boolean-only finish needs no trimming.
 *
 * @param finish Extracts the boolean-led result from the async result passed to the completion callback.
 * @returns A finish function resolving to the result without its leading boolean.
 */
const trimFinish =
    <R extends object, T extends readonly [boolean, unknown, ...unknown[]]>(
        finish: FinishResult<R, T>,
    ): FinishResult<R, TrimmedFinish<T>> =>
        (result: R): TrimmedFinish<T> => {
            const [, ...rest] = finish(result);

            return (rest.length === 1 ? rest[0] : rest) as TrimmedFinish<T>;
        };

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
const promisify = <R extends object, T>(
    asyncFn: (...args: unknown[]) => void,
    finish: FinishResult<R, T>,
    cancellable: object | null | undefined,
    ...leading: unknown[]
): Promise<T> =>
    new Promise<T>((resolve, reject) => {
        const creationStack =
            process.env.NODE_ENV === "production" ? undefined : new Error("GTKX async operation started here");

        const cancellableHandle = cancellable == null ? null : getHandle(cancellable);

        asyncFn(...leading, cancellableHandle, (_source: object | null, asyncResult: object) => {
            settle({ finish, creationStack, resolve, reject }, asyncResult);
        });
    });

export { promisify, trimFinish };
