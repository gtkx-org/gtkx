import { call, stop as nativeStop } from "../../index.js";

let started = false;
let exitHandlersRegistered = false;

const teardown = (): void => {
    if (started) {
        try {
            nativeStop();
        } catch {}
    }
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
    call("libgtk-4.so.1", "gtk_init", [], { type: "void" });
    registerExitHandlers();
};

export const stop = (): void => {
    if (!started) {
        return;
    }

    unregisterExitHandlers();
    nativeStop();
    started = false;
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
