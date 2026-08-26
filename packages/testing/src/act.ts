import { act as reactAct } from "react";

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

/** Work run inside the act environment, either synchronous or asynchronous. */
type ActCallback<T> = () => T | PromiseLike<T>;
/** Runs a callback inside React's act environment and settles with its result once updates flush. */
type ActImplementation = <T>(callback: ActCallback<T>) => PromiseLike<T>;

const actImplementation: ActImplementation = reactAct;
/**
 * Runs a callback inside React's act environment, flushing pending state
 * updates and effects, and resolves once the work has settled.
 *
 * @param callback Work to run within the act environment.
 * @returns A promise that resolves with the callback's result after updates flush.
 */
const act: ActImplementation = withGlobalActEnvironment(actImplementation);

const getIsReactActEnvironment = (): boolean | undefined => globalThis.IS_REACT_ACT_ENVIRONMENT;

const setIsReactActEnvironment = (value: boolean | undefined): void => {
    Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", value);
};

const isThenable = <T>(value: unknown): value is PromiseLike<T> =>
    value !== null && typeof value === "object" && typeof (value as PromiseLike<T>).then === "function";

const restoreAfter = async <T>(result: PromiseLike<T>, previous: boolean | undefined): Promise<T> => {
    try {
        return await result;
    } finally {
        setIsReactActEnvironment(previous);
    }
};

const runWithActEnvironment = <T>(isForced: boolean, fn: () => T | PromiseLike<T>): Promise<T> => {
    const previousActEnvironment = getIsReactActEnvironment();
    setIsReactActEnvironment(isForced);

    try {
        const result: T | PromiseLike<T> = fn();

        if (isThenable<T>(result)) {
            return restoreAfter(result, previousActEnvironment);
        }

        setIsReactActEnvironment(previousActEnvironment);

        return Promise.resolve(result);
    } catch (error) {
        setIsReactActEnvironment(previousActEnvironment);
        throw error;
    }
};

function withGlobalActEnvironment(actImplementation: ActImplementation): ActImplementation {
    return <T>(callback: ActCallback<T>): PromiseLike<T> => {
        const settled = runWithActEnvironment(true, () => actImplementation(() => callback()));

        return Promise.resolve(settled);
    };
}

const runInAct = async (callback: () => unknown): Promise<void> => {
    await act(() => callback());
};

export { act, getIsReactActEnvironment, runWithActEnvironment, runInAct, setIsReactActEnvironment };
