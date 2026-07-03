import { quit as nativeQuit } from "@gtkx/native";
import { blockMatchedSignalHandlers } from "./signal.js";

const KEEP_ALIVE_INTERVAL = 2147483647;

export type ApplicationLike = {
    getIsRegistered(): boolean;
    register(cancellable: null): boolean;
    activate(): void;
    quit(): void;
    run(argv: string[]): number;
    getWindows?(): object[];
    removeWindow?(window: object): void;
    on(signal: "activate" | "shutdown", handler: () => void): unknown;
};

const shutdownCallbacks: (() => void)[] = [];
let hasQuit = false;

export const onExit = (callback: () => void): void => {
    shutdownCallbacks.push(callback);
};

export const quit = (): void => {
    if (hasQuit) return;
    hasQuit = true;

    for (const callback of shutdownCallbacks) callback();

    nativeQuit();
};

process.on("exit", quit);

export const runApplication = (application: ApplicationLike): void => {
    let keepAliveTimeout: ReturnType<typeof setTimeout> | null = null;

    const scheduleKeepAlive = (): void => {
        keepAliveTimeout = setTimeout(scheduleKeepAlive, KEEP_ALIVE_INTERVAL);
    };

    application.on("activate", () => {
        if (keepAliveTimeout === null) scheduleKeepAlive();
    });

    application.on("shutdown", () => {
        if (keepAliveTimeout === null) return;
        clearTimeout(keepAliveTimeout);
        keepAliveTimeout = null;
    });

    if (!application.getIsRegistered()) application.register(null);
    application.activate();
};

export const quitApplication = (application: ApplicationLike): void => {
    if (!application.getIsRegistered()) return;
    for (const window of application.getWindows?.() ?? []) application.removeWindow?.(window);
    application.on("shutdown", () => application.quit());
    blockMatchedSignalHandlers(application, "activate");
    application.run([]);
};
