import gtkxWorker from "@gtkx/vitest";
import type { Plugin } from "vite";
import { gtkxVitePlugins } from "./vite-plugins/index.js";

const gtkx = (): Plugin[] => [...gtkxVitePlugins(), gtkxWorker()];

export default gtkx;
