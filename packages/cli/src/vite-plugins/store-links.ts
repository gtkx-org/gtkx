import type { Plugin, UserConfig } from "vite";
import { ensureStoreLinks } from "@gtkx/codegen/internal";

const GENERATED_MODULE_PREFIX = /^@gtkx\/(?:gi|jsx)\//;

function gtkxStoreLinks(): Plugin {
    const state = { root: "" };

    return {
        name: "gtkx:store-links",
        enforce: "pre",

        config(config: UserConfig) {
            state.root = config.root ?? process.cwd();
        },

        resolveId(source) {
            if (GENERATED_MODULE_PREFIX.test(source)) {
                ensureStoreLinks(state.root);
            }
        },
    };
}

export { gtkxStoreLinks };
