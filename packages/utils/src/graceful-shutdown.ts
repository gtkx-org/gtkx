/**
 * Cross-process graceful shutdown primitive for long-running Node processes.
 *
 * The helper installs `SIGINT`/`SIGTERM`/`SIGHUP` handlers, routes the first
 * delivered signal through a user-supplied close callback, and escalates either
 * on a second `SIGINT` or after a configurable timeout. On completion it calls
 * `process.exit` with the canonical exit code for the signal.
 */

const HANDLED_SIGNALS = ["SIGINT", "SIGTERM", "SIGHUP"] as const satisfies readonly NodeJS.Signals[];
const DEFAULT_FORCE_KILL_TIMEOUT_MS = 5000;

/**
 * Maps the POSIX signal that ended a process into the exit code shells use to
 * report it. `SIGINT` yields `130` (Ctrl-C), every other tracked signal yields
 * `143` (`SIGTERM`). A `null` signal — i.e. a clean exit — yields `0`.
 *
 * @param signal - The signal name, or `null` for a clean exit.
 * @returns The exit code shells expect for `signal`.
 */
export const exitCodeForSignal = (signal: NodeJS.Signals | null): number => {
    if (!signal) return 0;
    return signal === "SIGINT" ? 130 : 143;
};

/**
 * Caller-supplied behaviour for {@link installGracefulShutdown}.
 */
export type GracefulShutdownOptions = {
    /**
     * Invoked once on the first delivered signal. Its returned promise is
     * awaited before {@link process.exit} fires; rejection is logged but does
     * not block the exit.
     */
    onSignal: (signal: NodeJS.Signals) => void | Promise<void>;
    /**
     * Invoked when escalation is required: on a second `SIGINT`, or when
     * {@link GracefulShutdownOptions.forceKillAfterMs} elapses before the
     * primary close finishes.
     */
    onForce?: () => void;
    /**
     * Milliseconds to wait for the primary close before invoking `onForce`
     * and exiting. Defaults to {@link DEFAULT_FORCE_KILL_TIMEOUT_MS}. Set to
     * `0` to disable timeout-based escalation.
     */
    forceKillAfterMs?: number;
    /**
     * Overrides the exit code computed from the triggering signal. Use this
     * when the caller wants to propagate a child's own exit code instead.
     */
    exitCode?: (signal: NodeJS.Signals) => number;
};

/**
 * Handle returned by {@link installGracefulShutdown}, used to detach the
 * helper's signal handlers (for example in tests).
 */
export type GracefulShutdownHandle = {
    /**
     * Removes the installed signal handlers and cancels any pending
     * escalation timer. Idempotent.
     */
    uninstall: () => void;
};

/**
 * Installs the graceful-shutdown primitive on the current process.
 *
 * On the first matching signal: invokes `onSignal`, optionally schedules
 * `onForce` after `forceKillAfterMs`, awaits the close, then exits. A second
 * `SIGINT` (the canonical "force-kill" gesture) invokes `onForce`
 * immediately. The exit code defaults to {@link exitCodeForSignal} but can
 * be overridden by `exitCode`.
 *
 * @param options - Shutdown behaviour.
 * @returns A handle that detaches the installed signal handlers.
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
        if (signal === "SIGINT" && firstSignal === "SIGINT") {
            options.onForce?.();
            finish(signal);
        }
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
