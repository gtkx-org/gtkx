import type { Plugin } from "vite";

export const gtkxReactDomPrebundle = (): Plugin => ({
    name: "gtkx:react-dom-prebundle",
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
