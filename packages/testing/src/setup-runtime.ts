import { type GApplication, setApplicationLifecycle, setDeferredFlushWrapper } from "@gtkx/react";
import * as React from "react";
import { act, getIsReactActEnvironment } from "./act.js";

const hasActQueue = (value: unknown): value is { actQueue: unknown } =>
    typeof value === "object" && value !== null && "actQueue" in value;

const extractReactActQueueHolder = (): { actQueue: unknown } | null => {
    const reactExports: Record<string, unknown> = { ...React };
    const internals = reactExports.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
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

/**
 * Registers and activates application components but installs neither the
 * keep-alive nor the `shutdown` teardown the production lifecycle uses: the
 * test worker shares one GTK runtime across many per-test applications, so a
 * keep-alive would block the worker from terminating and emitting `shutdown`
 * on one application would tear the shared runtime down for the next test.
 */
setApplicationLifecycle({
    run: (application: GApplication) => {
        application.on("activate", () => {});
        if (!application.getIsRegistered()) application.register(null);
        application.activate();
    },
    quit: () => {},
});
