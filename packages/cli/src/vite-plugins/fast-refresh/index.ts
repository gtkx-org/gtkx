import type { Plugin } from "vite";
import type { RefreshFilterOptions } from "../../internal/vite-refresh-shared.js";
import { gtkxRefresh } from "./header.js";
import { swcSsrRefresh } from "./transform.js";

export const gtkxFastRefresh = (options: RefreshFilterOptions = {}): Plugin[] => [
    swcSsrRefresh(options),
    gtkxRefresh(options),
];
