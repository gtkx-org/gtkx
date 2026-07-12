import { error } from "./log.js";

const HANDLED_SIGNALS = ["SIGINT", "SIGTERM", "SIGHUP"] as const satisfies NodeJS.Signals[];
const DEFAULT_FORCE_KILL_TIMEOUT_MS = 5000;
const DEFAULT_COALESCE_WINDOW_MS = 500;

/**
 * Maps a terminating signal to its conventional process exit code (130 for `SIGINT`, 143 otherwise),
 * or 0 when no signal is given.
 *
 * @param signal The signal that triggered termination, or `null`.
 */
export const exitCodeForSignal = (signal: NodeJS.Signals | null): number => {
    if (!signal) return 0;
    return signal === "SIGINT" ? 130 : 143;
};

/**
 * Configuration for {@link installGracefulShutdown}.
 */
export type GracefulShutdownOptions = {
    /** Invoked with the first termination signal to perform cleanup before the process exits. */
    onSignal: (signal: NodeJS.Signals) => void | Promise<void>;
    /** Invoked when shutdown is forced, either by a repeated signal or the force-kill timeout. */
    onForce?: () => void;
    /** Milliseconds to wait for `onSignal` before forcing exit; a non-positive value disables the timeout. */
    forceKillAfterMs?: number;
    /** Milliseconds after the first signal during which repeated signals are ignored rather than forcing exit. */
    coalesceWindowMs?: number;
    /** Overrides the exit code chosen for a given signal and whether shutdown completed gracefully. */
    exitCode?: (signal: NodeJS.Signals, graceful: boolean) => number;
};

type ShutdownState = {
    options: GracefulShutdownOptions;
    forceKillMs: number;
    coalesceWindowMs: number;
    firstSignal: NodeJS.Signals | null;
    exited: boolean;
    coalescing: boolean;
    forceTimer: NodeJS.Timeout | null;
    coalesceTimer: NodeJS.Timeout | null;
};

const clearTimers = (state: ShutdownState): void => {
    if (state.forceTimer) {
        clearTimeout(state.forceTimer);
        state.forceTimer = null;
    }
    if (state.coalesceTimer) {
        clearTimeout(state.coalesceTimer);
        state.coalesceTimer = null;
    }
};

const finish = (state: ShutdownState, signal: NodeJS.Signals, graceful: boolean): void => {
    if (state.exited) return;
    state.exited = true;
    clearTimers(state);
    const { exitCode } = state.options;
    const code = exitCode ? exitCode(signal, graceful) : graceful ? 0 : exitCodeForSignal(signal);
    process.exit(code);
};

const beginShutdown = (state: ShutdownState, signal: NodeJS.Signals): void => {
    state.firstSignal = signal;
    if (state.coalesceWindowMs > 0) {
        state.coalescing = true;
        state.coalesceTimer = setTimeout(() => {
            state.coalescing = false;
        }, state.coalesceWindowMs);
        state.coalesceTimer.unref();
    }
    if (state.options.onForce && state.forceKillMs > 0) {
        state.forceTimer = setTimeout(() => {
            state.options.onForce?.();
            finish(state, signal, false);
        }, state.forceKillMs);
        state.forceTimer.unref();
    }
    Promise.resolve()
        .then(() => state.options.onSignal(signal))
        .then(
            () => finish(state, signal, true),
            (reason: unknown) => {
                error("graceful shutdown failed", reason);
                finish(state, signal, false);
            },
        );
};

const handle = (state: ShutdownState, signal: NodeJS.Signals): void => {
    if (state.firstSignal === null) {
        beginShutdown(state, signal);
        return;
    }
    if (state.coalescing) return;
    state.options.onForce?.();
    finish(state, signal, false);
};

/**
 * Registers handlers for `SIGINT`, `SIGTERM`, and `SIGHUP` that run the given cleanup callback once
 * and then exit, forcing exit if a repeated signal arrives or the cleanup exceeds its timeout.
 *
 * @param options The shutdown callbacks and timing configuration.
 */
export const installGracefulShutdown = (options: GracefulShutdownOptions): void => {
    const state: ShutdownState = {
        options,
        forceKillMs: options.forceKillAfterMs ?? DEFAULT_FORCE_KILL_TIMEOUT_MS,
        coalesceWindowMs: options.coalesceWindowMs ?? DEFAULT_COALESCE_WINDOW_MS,
        firstSignal: null,
        exited: false,
        coalescing: false,
        forceTimer: null,
        coalesceTimer: null,
    };
    for (const sig of HANDLED_SIGNALS) {
        process.on(sig, () => handle(state, sig));
    }
};
