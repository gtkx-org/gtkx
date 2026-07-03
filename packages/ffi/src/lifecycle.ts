import { quit as nativeQuit } from "@gtkx/native";

const KEEP_ALIVE_INTERVAL = 2147483647;

export type ApplicationRunner = {
    getIsRegistered(): boolean;
    getWindows?(): unknown[];
    removeWindow?(window: unknown): void;
    register(cancellable: null): boolean;
    activate(): void;
    on(signal: "activate" | "shutdown", handler: () => void): unknown;
    emit(signal: "shutdown"): void;
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

export const runApplication = (application: ApplicationRunner): void => {
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

export const quitApplication = (application: ApplicationRunner): void => {
    if (application.getIsRegistered()) {
        for (const window of application.getWindows?.() ?? []) {
            application.removeWindow?.(window);
        }
    }

    application.emit("shutdown");
};
