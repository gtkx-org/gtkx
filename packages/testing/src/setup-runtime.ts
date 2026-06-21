import type { GApplication } from "@gtkx/ffi";
import { setApplicationLifecycle, setDeferredFlushWrapper } from "@gtkx/react";
import * as React from "react";
import { act, getIsReactActEnvironment } from "./act.js";

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

setApplicationLifecycle({
    run: (application: GApplication) => {
        application.on("activate", () => {});
        if (!application.getIsRegistered()) application.register(null);
        application.activate();
    },
    quit: () => {},
});
