import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import {
    type RefreshFilterOptions,
    resolveRefreshFilter,
    shouldTransformForRefresh,
} from "../internal/vite-refresh-shared.js";

type GtkxRefreshOptions = RefreshFilterOptions;

const refreshRuntimePath = "@gtkx/cli/refresh-runtime";

export function gtkxRefresh(options: GtkxRefreshOptions = {}): Plugin {
    const filter = resolveRefreshFilter(options);

    return {
        name: "gtkx:refresh",
        enforce: "post",

        resolveId(id) {
            if (id !== refreshRuntimePath) return undefined;
            return fileURLToPath(import.meta.resolve(refreshRuntimePath));
        },

        transform(code, id, transformOptions) {
            if (!shouldTransformForRefresh(id, transformOptions, filter)) {
                return;
            }

            const hasRefreshReg = code.includes("$RefreshReg$");
            const hasRefreshSig = code.includes("$RefreshSig$");

            if (!hasRefreshReg && !hasRefreshSig) {
                return;
            }

            const moduleIdJson = JSON.stringify(id);

            const header = `
import { createModuleRegistration as __createModuleRegistration__ } from "${refreshRuntimePath}";
const { $RefreshReg$, $RefreshSig$ } = __createModuleRegistration__(${moduleIdJson});
`;

            return {
                code: header + code,
                map: null,
            };
        },
    };
}
