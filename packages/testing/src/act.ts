import { act as reactAct } from "react";

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

/** Work run inside the act environment, either synchronous or asynchronous. */
type ActCallback<T> = () => T | PromiseLike<T>;
/** Runs a callback inside React's act environment and settles with its result once updates flush. */
type ActImplementation = <T>(callback: ActCallback<T>) => PromiseLike<T>;

/** A callback's settled result, either directly or once its returned promise settles. */
type ActOutcome<T> = PromiseSettledResult<T> | Promise<PromiseSettledResult<T>>;

const isThenable = <T>(value: unknown): value is PromiseLike<T> =>
    value !== null && typeof value === "object" && typeof (value as PromiseLike<T>).then === "function";

const settleAsync = async <T>(result: PromiseLike<T>): Promise<PromiseSettledResult<T>> => {
    try {
        return { status: "fulfilled", value: await result };
    } catch (reason) {
        return { status: "rejected", reason };
    }
};

const settle = <T>(callback: ActCallback<T>): ActOutcome<T> => {
    try {
        const result = callback();

        return isThenable<T>(result) ? settleAsync(result) : { status: "fulfilled", value: result };
    } catch (reason) {
        return { status: "rejected", reason };
    }
};

const uncaughtErrors: WeakSet<object> = new WeakSet();

const rethrowUncaught = (reason: unknown): never => {
    if (typeof reason === "object" && reason !== null) {
        uncaughtErrors.add(reason);
    }

    throw reason;
};

/**
 * Whether an act scope rejected with this value because React collected it as an uncaught error, such as a render
 * or commit error no error boundary caught, rather than because the act callback threw it. Outside act, React
 * hands such errors to the root's `onUncaughtError`; several collected together arrive as one `AggregateError`.
 */
const isUncaughtError = (reason: unknown): boolean =>
    typeof reason === "object" && reason !== null && uncaughtErrors.has(reason);

const unwrap = <T>(outcome: PromiseSettledResult<T>): T => {
    if (outcome.status === "rejected") {
        throw outcome.reason;
    }

    return outcome.value;
};

// React's act leaves its queue installed when the callback throws, so later updates never render: https://github.com/react/react/issues/38031
const actImplementation: ActImplementation = <T>(callback: ActCallback<T>): PromiseLike<T> => {
    const attempt: { outcome?: ActOutcome<T> } = {};
    const settled = reactAct(() => {
        attempt.outcome = settle(callback);

        return attempt.outcome;
    });
    const { outcome } = attempt;

    if (!(outcome instanceof Promise) && outcome?.status === "rejected") {
        throw outcome.reason;
    }

    return Promise.resolve(settled).then(unwrap, rethrowUncaught);
};
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

export { act, getIsReactActEnvironment, isUncaughtError, runWithActEnvironment, runInAct, setIsReactActEnvironment };
