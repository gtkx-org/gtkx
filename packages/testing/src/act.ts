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

/**
 * Runs a callback inside React's act environment, flushing pending state
 * updates and effects, and resolves once the work has settled.
 *
 * @param callback Work to run within the act environment.
 * @returns A promise that resolves with the callback's result after updates flush.
 */
export const act: ActImplementation = withGlobalActEnvironment(actImplementation);

export const runInAct = (callback: () => unknown): Promise<void> =>
    Promise.resolve(act(() => callback())).then(() => undefined);
