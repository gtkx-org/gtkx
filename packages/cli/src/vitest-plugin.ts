import gtkxVitest from "@gtkx/vitest";
import type { Plugin } from "vite";
import { gtkxVitePlugins } from "./vite-plugins/index.js";

const gtkx = (): Plugin[] => [...gtkxVitePlugins(), gtkxVitest()];

export default gtkx;
