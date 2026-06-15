import { setApplicationLifecycle } from "@gtkx/react";
import { afterEach, beforeEach } from "vitest";

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

/**
 * Registers per-test hooks for suites driving `render` from `@gtkx/react`
 * directly: each test runs with React's act tracking disabled and with no-op
 * application lifecycle hooks, so mounting and unmounting an application
 * component neither keeps the worker alive nor quits the shared GTK runtime.
 * Both are undone after each test, returning to the harness's act environment
 * and default no-op lifecycle. Tests that observe the lifecycle install their
 * own hooks on top.
 */
export const setupRealRenderEnvironment = (): void => {
    let previousActEnvironment: boolean | undefined;

    beforeEach(() => {
        previousActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT;
        globalThis.IS_REACT_ACT_ENVIRONMENT = false;
        setApplicationLifecycle({ run: () => {}, quit: () => {} });
    });

    afterEach(() => {
        globalThis.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
        setApplicationLifecycle({ run: () => {}, quit: () => {} });
    });
};
