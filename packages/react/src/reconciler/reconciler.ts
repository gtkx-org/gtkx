import ReactReconciler from "react-reconciler";
import packageJson from "../../package.json" with { type: "json" };
import { createHostConfig, type ReconcilerInstance } from "./host-config.js";

export const reconciler: ReconcilerInstance = ReactReconciler(createHostConfig());

if (process.env["NODE_ENV"] !== "production") {
    reconciler.injectIntoDevTools({
        bundleType: 1,
        version: packageJson.version,
        rendererPackageName: "@gtkx/react",
    });
}
