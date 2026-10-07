import { quit as nativeQuit } from "@gtkx/native";

const shutdownCallbacks: (() => void)[] = [];

/**
 * Runs every registered exit callback and shuts down the native runtime. Safe to
 * call more than once; only the first call takes effect.
 */
const quit: () => void = createQuit();

function createQuit(): () => void {
    let hasQuit = false;

    return () => {
        if (hasQuit) {
            return;
        }

        hasQuit = true;
        const errors: unknown[] = [];
        const runCleanup = (cleanup: () => void): void => {
            try {
                cleanup();
            } catch (error) {
                errors.push(error);
            }
        };

        for (const callback of shutdownCallbacks) {
            runCleanup(callback);
        }

        runCleanup(nativeQuit);

        if (errors.length === 1) {
            throw errors[0];
        }

        if (errors.length > 1) {
            throw new AggregateError(errors, "GTKX shutdown failed");
        }
    };
}

/**
 * Registers a callback to run once when the process quits, before the native
 * runtime is torn down.
 *
 * @param callback Invoked during shutdown.
 */
const onExit = (callback: () => void): void => {
    shutdownCallbacks.push(callback);
};

export { onExit, quit };
