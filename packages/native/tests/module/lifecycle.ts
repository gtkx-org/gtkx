import { call, quit as nativeStop } from "../../index.js";

const KEEP_ALIVE_INTERVAL = 2147483647;

let started = false;
let stopped = false;
let keepAliveTimeout: ReturnType<typeof setTimeout> | null = null;
let exitHandlersRegistered = false;

const keepAlive = (): void => {
    keepAliveTimeout = setTimeout(keepAlive, KEEP_ALIVE_INTERVAL);
};

const teardown = (): void => {
    try {
        nativeStop();
    } catch {}
};

const handleSigint = (): void => {
    teardown();
    process.exit(130);
};

const handleSigterm = (): void => {
    teardown();
    process.exit(143);
};

const handleException = (error: unknown): void => {
    teardown();
    console.error(error);
    process.exit(1);
};

const handleRejection = (reason: unknown): void => {
    teardown();
    console.error("Unhandled rejection:", reason);
    process.exit(1);
};

const registerExitHandlers = (): void => {
    if (exitHandlersRegistered) {
        return;
    }
    exitHandlersRegistered = true;

    process.on("exit", teardown);
    process.on("SIGINT", handleSigint);
    process.on("SIGTERM", handleSigterm);
    process.on("uncaughtException", handleException);
    process.on("unhandledRejection", handleRejection);
};

const unregisterExitHandlers = (): void => {
    if (!exitHandlersRegistered) {
        return;
    }
    exitHandlersRegistered = false;

    process.off("exit", teardown);
    process.off("SIGINT", handleSigint);
    process.off("SIGTERM", handleSigterm);
    process.off("uncaughtException", handleException);
    process.off("unhandledRejection", handleRejection);
};

export const start = (): void => {
    if (started) {
        return;
    }
    started = true;

    keepAlive();
    call("libgtk-4.so.1", "gtk_init", [], { type: "void" });
    registerExitHandlers();
};

export const stop = (): void => {
    if (stopped) {
        return;
    }
    stopped = true;

    unregisterExitHandlers();
    nativeStop();

    if (keepAliveTimeout) {
        clearTimeout(keepAliveTimeout);
        keepAliveTimeout = null;
    }
};

export const suppressUnhandledRejections = async (fn: () => void): Promise<void> => {
    const savedListeners = process.rawListeners("unhandledRejection").slice();
    process.removeAllListeners("unhandledRejection");
    process.on("unhandledRejection", () => {});

    fn();

    await new Promise((resolve) => setTimeout(resolve, 100));

    process.removeAllListeners("unhandledRejection");
    for (const listener of savedListeners) {
        process.on("unhandledRejection", listener as (...args: unknown[]) => void);
    }
};
