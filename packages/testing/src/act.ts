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

const isThenable = <T>(value: T | PromiseLike<T>): value is PromiseLike<T> =>
    value !== null && typeof value === "object" && typeof (value as PromiseLike<T>).then === "function";

const withGlobalActEnvironment =
    (actImplementation: ActImplementation): ActImplementation =>
    <T>(callback: ActCallback<T>): PromiseLike<T> => {
        const previousActEnvironment = getIsReactActEnvironment();
        setIsReactActEnvironment(true);

        const restore = (): void => {
            setIsReactActEnvironment(previousActEnvironment);
        };

        try {
            let callbackNeedsToBeAwaited = false;
            const actResult = actImplementation(() => {
                const result = callback();
                if (isThenable(result)) {
                    callbackNeedsToBeAwaited = true;
                }
                return result;
            });

            if (callbackNeedsToBeAwaited) {
                return actResult.then(
                    (value) => {
                        restore();
                        return value;
                    },
                    (error) => {
                        restore();
                        throw error;
                    },
                );
            }

            restore();
            return actResult;
        } catch (error) {
            restore();
            throw error;
        }
    };

export const act: ActImplementation = withGlobalActEnvironment(reactAct as ActImplementation);
