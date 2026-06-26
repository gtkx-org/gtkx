import type { Plugin } from "vite";
import { gtkxRefreshRuntime, gtkxSwcRefresh } from "./swc-refresh.js";

export const gtkxFastRefresh = (): Plugin[] => [gtkxSwcRefresh(), gtkxRefreshRuntime()];
