import { installGracefulShutdown } from "@gtkx/utils";

declare global {
    var gtkxHeadlessTeardown: (() => void) | undefined;
    var gtkxHeadlessShutdownInstalled: boolean | undefined;
}

/**
 * Wires the headless-display teardown captured by the worker preload into the
 * shared graceful-shutdown handler so that a termination signal reaps the
 * compositor and its runtime directory before the worker exits.
 *
 * The preload runs in the raw Node process that boots each vitest worker and
 * stashes its teardown on {@link globalThis}; this setup file runs in the
 * transformed worker context where `@gtkx/utils` resolves, then registers the
 * signal handlers exactly once per process regardless of how many test files
 * the worker serves.
 */
export const installHeadlessShutdown = (): void => {
    const teardown = globalThis.gtkxHeadlessTeardown;
    if (teardown === undefined || globalThis.gtkxHeadlessShutdownInstalled === true) return;
    globalThis.gtkxHeadlessShutdownInstalled = true;
    installGracefulShutdown({ onSignal: teardown });
};

installHeadlessShutdown();
