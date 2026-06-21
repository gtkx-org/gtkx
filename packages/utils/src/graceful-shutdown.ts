const HANDLED_SIGNALS = ["SIGINT", "SIGTERM", "SIGHUP"] as const satisfies NodeJS.Signals[];
const DEFAULT_FORCE_KILL_TIMEOUT_MS = 5000;

/**
 * Maps a terminating signal to its canonical process exit code.
 *
 * @param signal - the signal that triggered shutdown, or `null` for a clean exit
 * @returns `0` when there is no signal, `130` for `SIGINT`, otherwise `143`
 */
export const exitCodeForSignal = (signal: NodeJS.Signals | null): number => {
    if (!signal) return 0;
    return signal === "SIGINT" ? 130 : 143;
};

/**
 * Options controlling {@link installGracefulShutdown}.
 */
export type GracefulShutdownOptions = {
    /**
     * Invoked once with the first handled signal to run the graceful shutdown
     * work; may return a promise that is awaited before the process exits.
     */
    onSignal: (signal: NodeJS.Signals) => void | Promise<void>;
    /**
     * Invoked when shutdown is escalated to a forced exit, either because a
     * second handled signal arrived or because {@link GracefulShutdownOptions.forceKillAfterMs}
     * elapsed before `onSignal` settled.
     */
    onForce?: () => void;
    /**
     * Milliseconds to wait for `onSignal` to settle before forcing exit. A value
     * of `0` or less disables the timeout. Defaults to 5000.
     */
    forceKillAfterMs?: number;
    /**
     * Overrides the exit code derived from the signal via {@link exitCodeForSignal}.
     */
    exitCode?: (signal: NodeJS.Signals) => number;
};

/**
 * Handle returned by {@link installGracefulShutdown} for tearing it down.
 */
export type GracefulShutdownHandle = {
    /**
     * Removes the installed signal listeners and clears any pending force-kill
     * timer.
     */
    uninstall: () => void;
};

/**
 * Installs handlers for `SIGINT`, `SIGTERM`, and `SIGHUP` that run a graceful
 * shutdown and then exit.
 *
 * The first handled signal records itself, optionally arms a force-kill timer,
 * and runs `onSignal`; the process exits once `onSignal` settles (or rejects,
 * after logging). Any subsequent handled signal — of any kind — escalates
 * immediately to `onForce` followed by exit, so the user can always force
 * termination by repeating the signal they first sent.
 *
 * @param options - the shutdown callbacks and timing overrides
 * @returns a handle whose `uninstall` removes the listeners and clears the timer
 */
export const installGracefulShutdown = (options: GracefulShutdownOptions): GracefulShutdownHandle => {
    const forceKillMs = options.forceKillAfterMs ?? DEFAULT_FORCE_KILL_TIMEOUT_MS;

    let firstSignal: NodeJS.Signals | null = null;
    let exited = false;
    let forceTimer: NodeJS.Timeout | null = null;

    const clearTimer = (): void => {
        if (forceTimer) {
            clearTimeout(forceTimer);
            forceTimer = null;
        }
    };

    const finish = (signal: NodeJS.Signals): void => {
        if (exited) return;
        exited = true;
        clearTimer();
        const code = options.exitCode ? options.exitCode(signal) : exitCodeForSignal(signal);
        process.exit(code);
    };

    const handle = (signal: NodeJS.Signals): void => {
        if (firstSignal === null) {
            firstSignal = signal;
            if (options.onForce && forceKillMs > 0) {
                forceTimer = setTimeout(() => {
                    options.onForce?.();
                    finish(signal);
                }, forceKillMs);
                forceTimer.unref?.();
            }
            Promise.resolve()
                .then(() => options.onSignal(signal))
                .catch((error: unknown) => {
                    console.error("Graceful shutdown error:", error);
                })
                .finally(() => finish(signal));
            return;
        }
        options.onForce?.();
        finish(signal);
    };

    const handlers = new Map<NodeJS.Signals, () => void>();
    for (const sig of HANDLED_SIGNALS) {
        const listener = (): void => handle(sig);
        handlers.set(sig, listener);
        process.on(sig, listener);
    }

    return {
        uninstall: () => {
            for (const [sig, listener] of handlers) {
                process.removeListener(sig, listener);
            }
            handlers.clear();
            clearTimer();
        },
    };
};
