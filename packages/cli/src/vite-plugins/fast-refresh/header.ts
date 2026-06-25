import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import { createRefreshGate, REFRESH_REG, REFRESH_RUNTIME_SPECIFIER, REFRESH_SIG } from "./refresh-filter.js";

export function gtkxRefresh(): Plugin {
    const gate = createRefreshGate();

    return {
        name: "gtkx:refresh",
        enforce: "post",

        resolveId(id) {
            if (id !== REFRESH_RUNTIME_SPECIFIER) return undefined;
            return fileURLToPath(import.meta.resolve(REFRESH_RUNTIME_SPECIFIER));
        },

        transform(code, id, transformOptions) {
            if (!gate(id, transformOptions)) {
                return;
            }

            if (!code.includes(REFRESH_REG) && !code.includes(REFRESH_SIG)) {
                return;
            }

            const moduleIdJson = JSON.stringify(id);

            const header = `
import { createModuleRegistration as __createModuleRegistration__ } from "${REFRESH_RUNTIME_SPECIFIER}";
const { ${REFRESH_REG}, ${REFRESH_SIG} } = __createModuleRegistration__(${moduleIdJson});
`;

            return {
                code: header + code,
                map: null,
            };
        },
    };
}
