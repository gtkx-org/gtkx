import { createGtkxConfigLoader, createGtkxConfigPlugin, type GtkxConfigLoader } from "@gtkx/config";
import type { Plugin } from "vite";

export function gtkxConfig(loadConfig: GtkxConfigLoader = createGtkxConfigLoader()): Plugin {
    return createGtkxConfigPlugin({ name: "gtkx:config", loadConfig });
}
