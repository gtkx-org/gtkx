import { error } from "../log/default-logger.ts";
import { exitCodeForSignal } from "./exit-code-for-signal.ts";

type GracefulShutdownOptions = {
    onSignal: (signal: NodeJS.Signals) => void | Promise<void>;
    onForce?: () => void;
    forceKillAfterMs?: number;
    coalesceWindowMs?: number;
    exitCode?: (signal: NodeJS.Signals, isGraceful: boolean) => number;
};

type ShutdownState = {
    options: GracefulShutdownOptions;
    forceKillMs: number;
    coalesceWindowMs: number;
    firstSignal: NodeJS.Signals | null;
    hasExited: boolean;
    isCoalescing: boolean;
    forceTimer: NodeJS.Timeout | null;
    coalesceTimer: NodeJS.Timeout | null;
};

const HANDLED_SIGNALS = ["SIGINT", "SIGTERM", "SIGHUP"] as const satisfies NodeJS.Signals[];
const DEFAULT_FORCE_KILL_TIMEOUT_MS = 5000;
const DEFAULT_COALESCE_WINDOW_MS = 500;

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

const finish = (state: ShutdownState, signal: NodeJS.Signals, isGraceful: boolean): void => {
    if (state.hasExited) {
        return;
    }

    state.hasExited = true;
    clearTimers(state);
    const { exitCode } = state.options;
    const defaultCode = isGraceful ? 0 : exitCodeForSignal(signal);
    process.exit(exitCode ? exitCode(signal, isGraceful) : defaultCode);
};

const runShutdown = async (state: ShutdownState, signal: NodeJS.Signals): Promise<void> => {
    try {
        await state.options.onSignal(signal);
        finish(state, signal, true);
    } catch (error_) {
        error("graceful shutdown failed", error_);
        finish(state, signal, false);
    }
};

const beginShutdown = (state: ShutdownState, signal: NodeJS.Signals): void => {
    state.firstSignal = signal;

    if (state.coalesceWindowMs > 0) {
        state.isCoalescing = true;

        state.coalesceTimer = setTimeout(() => {
            state.isCoalescing = false;
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

    void runShutdown(state, signal);
};

const handle = (state: ShutdownState, signal: NodeJS.Signals): void => {
    if (state.firstSignal === null) {
        beginShutdown(state, signal);

        return;
    }

    if (state.isCoalescing) {
        return;
    }

    state.options.onForce?.();
    finish(state, signal, false);
};

function installGracefulShutdown(options: GracefulShutdownOptions): void {
    const state: ShutdownState = {
        options,
        forceKillMs: options.forceKillAfterMs ?? DEFAULT_FORCE_KILL_TIMEOUT_MS,
        coalesceWindowMs: options.coalesceWindowMs ?? DEFAULT_COALESCE_WINDOW_MS,
        firstSignal: null,
        hasExited: false,
        isCoalescing: false,
        forceTimer: null,
        coalesceTimer: null,
    };

    for (const sig of HANDLED_SIGNALS) {
        process.on(sig, () => {
            handle(state, sig);
        });
    }
}

export { installGracefulShutdown, type GracefulShutdownOptions };
