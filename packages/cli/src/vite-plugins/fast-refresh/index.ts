import type { Plugin } from "vite";
import { gtkxRefresh } from "./header.js";
import { gtkxSwcSsrRefresh } from "./transform.js";

export const gtkxFastRefresh = (): Plugin[] => [gtkxSwcSsrRefresh(), gtkxRefresh()];
