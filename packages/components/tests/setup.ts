import { afterAll, beforeAll } from "vitest";

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

let previousIsReactActEnvironment: boolean | undefined;

beforeAll(() => {
    previousIsReactActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT;
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
});

afterAll(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = previousIsReactActEnvironment;
});
