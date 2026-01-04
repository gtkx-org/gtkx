import ReactReconciler from "react-reconciler";
import packageJson from "../package.json" with { type: "json" };
import { createHostConfig, type ReconcilerInstance } from "./host-config.js";

/**
 * Manages the React reconciler instance for GTKX.
 *
 * This class wraps the React Reconciler and handles initialization
 * including DevTools integration for development environments.
 *
 * @internal
 */
class Reconciler {
    private instance: ReconcilerInstance;

    constructor() {
        this.instance = ReactReconciler(createHostConfig());
        this.injectDevTools();
    }

    /**
     * Returns the underlying React Reconciler instance.
     *
     * @returns The React Reconciler instance for direct reconciler operations
     */
    getInstance(): ReconcilerInstance {
        return this.instance;
    }

    private injectDevTools(): void {
        if (process.env.NODE_ENV === "production") return;

        this.instance.injectIntoDevTools({
            bundleType: 1,
            version: packageJson.version,
            rendererPackageName: "@gtkx/react",
        });
    }
}

/**
 * The GTKX React reconciler instance.
 *
 * Provides low-level access to the React reconciler for advanced use cases.
 * Most applications should use {@link render} instead.
 *
 * @example
 * ```tsx
 * const instance = reconciler.getInstance();
 * ```
 */
export const reconciler = new Reconciler();
