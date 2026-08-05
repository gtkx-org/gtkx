import { beforeAll } from "vitest";

declare global {
    // eslint-disable-next-line gtkx/boolean-name
    var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

const setActEnvironment = (value: boolean | undefined): void => {
    Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { value, configurable: true, writable: true });
};

beforeAll(() => {
    const previousIsReactActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT;
    setActEnvironment(true);

    return () => {
        setActEnvironment(previousIsReactActEnvironment);
    };
});
