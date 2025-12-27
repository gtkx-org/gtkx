import ReactReconciler from "react-reconciler";
import packageJson from "../package.json" with { type: "json" };
import { createHostConfig, type ReconcilerInstance } from "./host-config.js";

class Reconciler {
    private instance: ReconcilerInstance;

    constructor() {
        this.instance = ReactReconciler(createHostConfig());
        this.injectDevTools();
    }

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

export const reconciler = new Reconciler();
