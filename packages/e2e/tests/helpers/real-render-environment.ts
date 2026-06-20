import { getIsReactActEnvironment, setIsReactActEnvironment } from "@gtkx/testing/act";
import { afterEach, beforeEach } from "vitest";

/**
 * Registers per-test hooks for suites driving `render` from `@gtkx/react`
 * directly: each test runs with React's act tracking disabled, so mounting an
 * application component runs the real application lifecycle as it does in
 * production. The flag is restored after each test.
 */
export const setupRealRenderEnvironment = (): void => {
    let previousActEnvironment: boolean | undefined;

    beforeEach(() => {
        previousActEnvironment = getIsReactActEnvironment();
        setIsReactActEnvironment(false);
    });

    afterEach(() => {
        setIsReactActEnvironment(previousActEnvironment);
    });
};
