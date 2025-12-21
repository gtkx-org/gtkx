import { poll as nativePoll, start as nativeStart, stop as nativeStop } from "@gtkx/native";
import { init as initAdwaita } from "../generated/adw/functions.js";
import type { ApplicationFlags } from "../generated/gio/enums.js";
import type { Application } from "../generated/gtk/application.js";
import { finalize as finalizeGtkSource, init as initGtkSource } from "../generated/gtksource/functions.js";
import { events } from "./events.js";
import { getNativeObject } from "./object.js";

declare const Deno: unknown;
const isDeno = typeof Deno !== "undefined";

let currentApp: Application | null = null;
let keepAliveTimeout: ReturnType<typeof setTimeout> | null = null;
let pollInterval: ReturnType<typeof setInterval> | null = null;

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
 * Gets the current GTK application instance.
 * @returns The GTK Application instance
 * @throws Error if GTK has not been started yet
 */
export const getApplication = (): Application => {
    if (!currentApp) {
        throw new Error("GTK application not initialized. Call start() first.");
    }
    return currentApp;
};

/**
 * Starts the GTK application with the given application ID.
 * Sets up a keep-alive timer to prevent Node.js from exiting.
 * This function is idempotent - calling it multiple times returns the existing app.
 * @param appId - The application ID (e.g., "com.example.myapp")
 * @param flags - Optional GIO application flags
 * @returns The GTK Application instance
 */
export const start = (appId: string, flags?: ApplicationFlags): Application => {
    if (currentApp) {
        return currentApp;
    }

    const app = nativeStart(appId, flags);
    currentApp = getNativeObject(app);
    events.emit("start");

    try {
        initAdwaita();
        initGtkSource();
    } catch {}

    keepAlive();

    if (isDeno) {
        startPolling();
    }

    if (!currentApp) {
        throw new Error("Failed to initialize GTK Application.");
    }

    return currentApp;
};

/**
 * Stops the GTK application and cleans up the keep-alive timer.
 * Emits the "stop" event before shutting down to allow cleanup.
 * This function is idempotent - calling it when not started does nothing.
 */
export const stop = (): void => {
    if (!currentApp) {
        return;
    }

    if (keepAliveTimeout) {
        clearTimeout(keepAliveTimeout);
        keepAliveTimeout = null;
    }

    stopPolling();

    events.emit("stop");

    try {
        finalizeGtkSource();
    } catch {}

    nativeStop();
    currentApp = null;
};
