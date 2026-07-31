import type { Plugin } from "vite";
import gtkxVitest from "@gtkx/vitest";
import { gtkxVitePlugins } from "./vite-plugins/index.js";
import { gtkxSettingsWorkerEnv } from "./vite-plugins/settings-worker-env.js";

const gtkx = (): Plugin[] => [...gtkxVitePlugins(), gtkxSettingsWorkerEnv(), gtkxVitest()];
export default gtkx;
