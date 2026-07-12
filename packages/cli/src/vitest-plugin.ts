import gtkxVitest from "@gtkx/vitest";
import type { Plugin } from "vite";
import { gtkxVitePlugins } from "./vite-plugins/index.js";

/**
 * Vite plugin factory that assembles the plugins needed to run GTKX apps under Vitest,
 * combining the shared GTKX Vite plugins with the `@gtkx/vitest` test integration.
 *
 * @returns The ordered array of Vite plugins to include in a Vitest configuration.
 */
const gtkx = (): Plugin[] => [...gtkxVitePlugins(), gtkxVitest()];

export default gtkx;
