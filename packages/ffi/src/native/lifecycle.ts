import { poll as nativePoll, start as nativeStart, stop as nativeStop, type ObjectId } from "@gtkx/native";
import { init as initAdwaita } from "../generated/adw/functions.js";
import type { ApplicationFlags } from "../generated/gio/enums.js";
import type { Application } from "../generated/gtk/application.js";
import { finalize as finalizeGtkSource, init as initGtkSource } from "../generated/gtksource/functions.js";
import { events } from "./events.js";
import { getNativeObject } from "./object.js";

declare const Deno: unknown;
const isDeno = typeof Deno !== "undefined";

let keepAliveTimeout: ReturnType<typeof setTimeout> | null = null;
let pollInterval: ReturnType<typeof setInterval> | null = null;
let application: Application | null = null;
let exitHandlersRegistered = false;

const teardown = (): void => {
    if (application) {
        try {
            stop();
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
    if (exitHandlersRegistered || isDeno) {
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

const keepAlive = (): void => {
    keepAliveTimeout = setTimeout(() => keepAlive(), 2147483647);
};

const startPolling = (): void => {
    if (pollInterval) return;
    pollInterval = setInterval(() => nativePoll(), 0);
};

const stopPolling = (): void => {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
};

/**
 * Initializes the GTK application runtime.
 *
 * Creates a GTK Application instance, initializes Adwaita and GtkSource
 * if available, and starts the event loop.
 *
 * @param appId - Application ID in reverse domain notation (e.g., "com.example.app")
 * @param flags - Optional GIO application flags
 * @returns The GTK Application instance
 *
 * @example
 * ```tsx
 * import { start } from "@gtkx/ffi";
 *
 * const app = start("com.example.myapp");
 * ```
 *
 * @see {@link stop} for shutting down the application
 */
export const start = (appId: string, flags?: ApplicationFlags): Application => {
    if (application) {
        return application;
    }

    const app = nativeStart(appId, flags);
    events.emit("start");

    try {
        initAdwaita();
        initGtkSource();
    } catch {}

    keepAlive();

    if (isDeno) {
        startPolling();
    }

    application = getNativeObject(app as ObjectId) as Application;
    registerExitHandlers();
    return application;
};

/**
 * Shuts down the GTK application runtime.
 *
 * Stops the event loop, cleans up resources, and finalizes libraries.
 * Emits a "stop" event before cleanup.
 *
 * @see {@link start} for initializing the application
 * @see {@link events} for lifecycle event handling
 */
export const stop = (): void => {
    if (!application) {
        return;
    }

    unregisterExitHandlers();

    if (keepAliveTimeout) {
        clearTimeout(keepAliveTimeout);
        keepAliveTimeout = null;
    }

    stopPolling();
    events.emit("stop");

    try {
        finalizeGtkSource();
    } catch {}

    application = null;
    nativeStop();
};
