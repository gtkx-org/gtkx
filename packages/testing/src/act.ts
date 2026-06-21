/**
 * React `act` primitives exposed standalone via the `@gtkx/testing/act` subpath.
 *
 * This module deliberately does not import the harness `setup-runtime`, so consumers of the
 * `./act` subpath get only the act helpers without triggering harness side effects. Code that
 * renders through the harness must import the package main entry (`@gtkx/testing`) first, which
 * wires the deferred-flush, async/event wrappers, and application lifecycle.
 *
 * @packageDocumentation
 */

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
 * Temporarily forces `IS_REACT_ACT_ENVIRONMENT` to `forced` while `fn` runs, then restores
 * the previous value once `fn` settles.
 *
 * The previous flag value is captured before `fn` runs and reinstated whether `fn` returns
 * synchronously, returns a thenable that resolves, or throws/rejects. When `fn` returns a
 * thenable the restoration is deferred until that thenable settles, so async work observes
 * the forced value for its full duration.
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

export const act: ActImplementation = withGlobalActEnvironment(reactAct as ActImplementation);
