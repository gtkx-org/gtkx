import { setApplicationTeardown } from "@gtkx/react";
import { afterEach, beforeEach } from "vitest";

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

/**
 * Registers per-test hooks for suites driving `render` from `@gtkx/react`
 * directly: each test runs with React's act tracking disabled and with the
 * default application teardown restored, so unmounting an application
 * component stops the GTK runtime as it does in production. Both are undone
 * after each test, returning to the harness's act environment and no-op
 * teardown.
 */
export const setupRealRenderEnvironment = (): void => {
    let previousActEnvironment: boolean | undefined;

    beforeEach(() => {
        previousActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT;
        globalThis.IS_REACT_ACT_ENVIRONMENT = false;
        setApplicationTeardown(null);
    });

    afterEach(() => {
        globalThis.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
        setApplicationTeardown(() => {});
    });
};
