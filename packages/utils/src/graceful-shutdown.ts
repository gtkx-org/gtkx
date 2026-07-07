import { error } from "./log.js";

const HANDLED_SIGNALS = ["SIGINT", "SIGTERM", "SIGHUP"] as const satisfies NodeJS.Signals[];
const DEFAULT_FORCE_KILL_TIMEOUT_MS = 5000;

/**
 * Maps a terminating signal to the conventional POSIX exit code (`128 + signal
 * number`) used when reporting that a process was killed by that signal. Use it
 * only to propagate a genuine kill; a clean shutdown that merely started from a
 * signal should exit `0`.
 *
 * @param signal - The signal that terminated the process, or `null` for none.
 * @returns `0` when `signal` is `null`, `130` for `SIGINT`, otherwise `143`.
 */
export const exitCodeForSignal = (signal: NodeJS.Signals | null): number => {
    if (!signal) return 0;
    return signal === "SIGINT" ? 130 : 143;
};

/**
 * Configuration for {@link installGracefulShutdown}.
 */
export type GracefulShutdownOptions = {
    /**
     * Runs once when the first handled signal arrives. Resolving is treated as a
     * clean shutdown; rejecting is treated as a failed one.
     */
    onSignal: (signal: NodeJS.Signals) => void | Promise<void>;
    /**
     * Runs when shutdown is forced — a second signal, or the force-kill timeout
     * elapsing before {@link GracefulShutdownOptions.onSignal} settles.
     */
    onForce?: () => void;
    /**
     * Milliseconds to wait for {@link GracefulShutdownOptions.onSignal} before
     * escalating to {@link GracefulShutdownOptions.onForce}. Disabled when `0`.
     */
    forceKillAfterMs?: number;
    /**
     * Overrides the process exit code. Receives the triggering signal and
     * whether the shutdown completed gracefully (`onSignal` resolved without
     * being forced).
     */
    exitCode?: (signal: NodeJS.Signals, graceful: boolean) => number;
};

/**
 * Installs handlers for `SIGINT`, `SIGTERM`, and `SIGHUP` that run a shutdown
 * routine and then exit the process. A shutdown triggered by a signal is a
 * clean, intended stop, so it exits `0` by default; a forced or failed shutdown
 * exits with {@link exitCodeForSignal}. Provide
 * {@link GracefulShutdownOptions.exitCode} to propagate a different code.
 *
 * @param options - The shutdown behavior to install.
 */
export const installGracefulShutdown = (options: GracefulShutdownOptions): void => {
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

    const finish = (signal: NodeJS.Signals, graceful: boolean): void => {
        if (exited) return;
        exited = true;
        clearTimer();
        const code = options.exitCode ? options.exitCode(signal, graceful) : graceful ? 0 : exitCodeForSignal(signal);
        process.exit(code);
    };

    const handle = (signal: NodeJS.Signals): void => {
        if (firstSignal === null) {
            firstSignal = signal;
            if (options.onForce && forceKillMs > 0) {
                forceTimer = setTimeout(() => {
                    options.onForce?.();
                    finish(signal, false);
                }, forceKillMs);
                forceTimer.unref?.();
            }
            Promise.resolve()
                .then(() => options.onSignal(signal))
                .then(
                    () => finish(signal, true),
                    (reason: unknown) => {
                        error("graceful shutdown failed", reason);
                        finish(signal, false);
                    },
                );
            return;
        }
        options.onForce?.();
        finish(signal, false);
    };

    for (const sig of HANDLED_SIGNALS) {
        process.on(sig, () => handle(sig));
    }
};
