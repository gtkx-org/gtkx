import { type NativeHandle, poll as nativePoll, start as nativeStart, stop as nativeStop } from "@gtkx/native";
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
let isStopping = false;

/**
 * Whether the GTK application runtime is currently running.
 * `true` if {@link start} has been called and {@link stop} has not.
 */
export let isStarted = false;

/**
 * Returns why FFI calls are not allowed, or null if they are allowed.
 *
 * @returns Error reason string, or null if runtime is available
 */
export const getStartError = (): string | null => {
    if (!isStarted) {
        return "GTK runtime not started. Call start() before making FFI calls.";
    }
    return null;
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
    isStarted = true;
    application = getNativeObject(app as NativeHandle) as Application;

    try {
        initAdwaita();
        initGtkSource();
    } catch {}

    keepAlive();

    if (isDeno) {
        startPolling();
    }

    events.emit("start");
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
    if (!application || isStopping) {
        return;
    }

    isStopping = true;

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
    isStarted = false;
    nativeStop();
    isStopping = false;
};
