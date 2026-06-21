import type { GApplication } from "@gtkx/ffi";
import { setApplicationLifecycle } from "@gtkx/react";
import { setDeferredFlushWrapper } from "@gtkx/react/internal";
import * as React from "react";
import { act, getIsReactActEnvironment, runWithActEnvironment } from "./act.js";
import { configure } from "./config.js";

const hasActQueue = (value: unknown): value is { actQueue: unknown } =>
    typeof value === "object" && value !== null && "actQueue" in value;

const extractReactActQueueHolder = (): { actQueue: unknown } | null => {
    const reactExports: Record<string, unknown> = { ...React };
    const internals = reactExports["__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE"];
    return hasActQueue(internals) ? internals : null;
};

const reactActQueueHolder = extractReactActQueueHolder();

const isActQueueInstalled = (): boolean => reactActQueueHolder !== null && reactActQueueHolder.actQueue !== null;

setDeferredFlushWrapper((flush) => {
    if (!getIsReactActEnvironment() || isActQueueInstalled()) {
        flush();
        return;
    }
    void act(() => {
        flush();
    });
});

const drainMicrotasks = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

configure({
    asyncWrapper: <T>(callback: () => Promise<T>): Promise<T> =>
        Promise.resolve(
            runWithActEnvironment(false, async () => {
                const result = await callback();
                await drainMicrotasks();
                return result;
            }),
        ),
    eventWrapper: (callback: () => void): Promise<void> => Promise.resolve(act(() => callback())).then(),
});

setApplicationLifecycle({
    run: (application: GApplication) => {
        application.on("activate", () => {});
        if (!application.getIsRegistered()) application.register(null);
        application.activate();
    },
    quit: () => {},
});
