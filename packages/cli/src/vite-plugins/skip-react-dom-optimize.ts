import type { Plugin } from "vite";

export const gtkxSkipReactDomOptimize = (): Plugin => ({
    name: "gtkx:skip-react-dom-optimize",
    enforce: "post",
    config(config) {
        config.optimizeDeps ??= {};
        if (config.optimizeDeps.include) {
            config.optimizeDeps.include = config.optimizeDeps.include.filter(
                (dep) => dep !== "react-dom" && !dep.startsWith("react-dom/"),
            );
        }
    },
});
