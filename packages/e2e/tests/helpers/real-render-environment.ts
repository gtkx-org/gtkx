import { afterEach, beforeEach } from "vitest";

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

/**
 * Registers per-test hooks for suites driving `render` from `@gtkx/react`
 * directly: each test runs with React's act tracking disabled, so mounting an
 * application component runs the real application lifecycle as it does in
 * production. The flag is restored after each test.
 */
export const setupRealRenderEnvironment = (): void => {
    let previousActEnvironment: boolean | undefined;

    beforeEach(() => {
        previousActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT;
        globalThis.IS_REACT_ACT_ENVIRONMENT = false;
    });

    afterEach(() => {
        globalThis.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
    });
};
