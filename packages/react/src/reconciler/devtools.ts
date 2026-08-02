import type ReactReconciler from "react-reconciler";
import { version } from "react";

type BundleType = ReactReconciler.DevToolsConfig<never, never, never>["bundleType"];

type DevToolsInjectable = {
    injectIntoDevTools: (config: { bundleType: BundleType; version: string; rendererPackageName: string }) => unknown;
};

const DEVELOPMENT_BUNDLE: BundleType = 1;
const PRODUCTION_BUNDLE: BundleType = 0;
const injection = { isDone: false };

const hasDevToolsHook = (): boolean =>
    (globalThis as unknown as Record<string, unknown>).__REACT_DEVTOOLS_GLOBAL_HOOK__ !== undefined;

const bundleType = (): BundleType =>
    process.env.NODE_ENV === "production" ? PRODUCTION_BUNDLE : DEVELOPMENT_BUNDLE;

const injectIntoDevTools = (reconciler: DevToolsInjectable): void => {
    if (injection.isDone || !hasDevToolsHook()) {
        return;
    }

    injection.isDone = true;
    reconciler.injectIntoDevTools({ bundleType: bundleType(), version, rendererPackageName: "@gtkx/react" });
};

export { injectIntoDevTools };
