import { act as reactAct } from "react";

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

const getGlobalThis = (): typeof globalThis => {
    if (typeof globalThis !== "undefined") return globalThis;
    throw new Error("unable to locate global object");
};

export const getIsReactActEnvironment = (): boolean | undefined => getGlobalThis().IS_REACT_ACT_ENVIRONMENT;

export const setIsReactActEnvironment = (value: boolean | undefined): void => {
    getGlobalThis().IS_REACT_ACT_ENVIRONMENT = value;
};

type ActCallback<T> = () => T | PromiseLike<T>;
type ActImplementation = <T>(callback: ActCallback<T>) => PromiseLike<T>;

const isThenable = <T>(value: unknown): value is PromiseLike<T> =>
    value !== null && typeof value === "object" && typeof (value as PromiseLike<T>).then === "function";

/**
 * Runs `fn` with the React act-environment flag forced to `forced`, restoring the
 * previous flag once `fn` settles.
 *
 * When `fn` returns a thenable it is adopted through `Promise.resolve` before any
 * `.then` is chained: React's `act()` hands back a thenable whose `then` itself
 * performs the work — flushing the act queue and draining a macrotask — and only
 * resolves afterward. Adopting it keeps the returned promise pending until that
 * resolution; chaining a bare `.then` directly onto it instead would settle on the
 * next microtask, before React's flush completes.
 */
export const runWithActEnvironment = <T>(forced: boolean, fn: () => T | PromiseLike<T>): T | PromiseLike<T> => {
    const previousActEnvironment = getIsReactActEnvironment();
    setIsReactActEnvironment(forced);
    try {
        const result = fn();
        if (isThenable<T>(result)) {
            return Promise.resolve(result).then(
                (value) => {
                    setIsReactActEnvironment(previousActEnvironment);
                    return value;
                },
                (error) => {
                    setIsReactActEnvironment(previousActEnvironment);
                    throw error;
                },
            );
        }
        setIsReactActEnvironment(previousActEnvironment);
        return result;
    } catch (error) {
        setIsReactActEnvironment(previousActEnvironment);
        throw error;
    }
};

const withGlobalActEnvironment =
    (actImplementation: ActImplementation) =>
    <T>(callback: ActCallback<T>): PromiseLike<T> => {
        const settled = runWithActEnvironment(true, () => actImplementation(() => callback()));
        return Promise.resolve(settled);
    };

const actImplementation: ActImplementation = reactAct as ActImplementation;

export const act: ActImplementation = withGlobalActEnvironment(actImplementation);
