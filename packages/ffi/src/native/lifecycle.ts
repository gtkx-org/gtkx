import { poll as nativePoll, start as nativeStart, stop as nativeStop } from "@gtkx/native";
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

    application = getNativeObject(app) as Application;
    return application;
};

export const stop = (): void => {
    if (!application) {
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

    application = null;
    nativeStop();
};
