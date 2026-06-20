import type { Plugin } from "vite";
import type { RefreshFilterOptions } from "../../internal/vite-refresh-shared.js";
import { gtkxRefresh } from "./header.js";
import { swcSsrRefresh } from "./transform.js";

/**
 * Builds the GTKX Fast Refresh plugin pair in the order their `enforce` phases
 * require: the SWC transform (`enforce: "pre"`) emits the `$RefreshReg$`/
 * `$RefreshSig$` calls, then the header plugin (`enforce: "post"`) prepends the
 * matching registration import. Keeping the ordering contract here lets the dev
 * runner spread one factory instead of hand-listing both plugins.
 *
 * @param options - Include/exclude overrides shared by both plugins.
 * @returns The ordered `[transform, header]` plugin pair.
 */
export const gtkxFastRefresh = (options: RefreshFilterOptions = {}): Plugin[] => [
    swcSsrRefresh(options),
    gtkxRefresh(options),
];
