const HANDLED_SIGNALS = ["SIGINT", "SIGTERM", "SIGHUP"] as const satisfies NodeJS.Signals[];
const DEFAULT_FORCE_KILL_TIMEOUT_MS = 5000;

export const exitCodeForSignal = (signal: NodeJS.Signals | null): number => {
    if (!signal) return 0;
    return signal === "SIGINT" ? 130 : 143;
};

export type GracefulShutdownOptions = {
    onSignal: (signal: NodeJS.Signals) => void | Promise<void>;
    onForce?: () => void;
    forceKillAfterMs?: number;
    exitCode?: (signal: NodeJS.Signals) => number;
};

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

    for (const sig of HANDLED_SIGNALS) {
        process.on(sig, () => handle(sig));
    }
};
