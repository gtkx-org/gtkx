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

const withGlobalActEnvironment =
    (actImplementation: ActImplementation) =>
    <T>(callback: ActCallback<T>): PromiseLike<T> => {
        const previousActEnvironment = getIsReactActEnvironment();
        setIsReactActEnvironment(true);
        try {
            let callbackNeedsToBeAwaited = false;
            const actResult = actImplementation(() => {
                const result = callback();
                if (isThenable<T>(result)) {
                    callbackNeedsToBeAwaited = true;
                }
                return result;
            });
            if (callbackNeedsToBeAwaited) {
                return Promise.resolve(actResult).then(
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
            return actResult;
        } catch (error) {
            setIsReactActEnvironment(previousActEnvironment);
            throw error;
        }
    };

export const act: ActImplementation = withGlobalActEnvironment(reactAct as ActImplementation);
