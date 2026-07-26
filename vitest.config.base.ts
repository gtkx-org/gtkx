import { GTKX_INLINE_DEPS } from "@gtkx/vitest";
import { defineConfig } from "vitest/config";

const sourceResolveConfig = defineConfig({
    ssr: {
        resolve: {
            conditions: ["source", "module", "node", "development|production"],
        },
    },
    test: {
        server: {
            deps: {
                inline: GTKX_INLINE_DEPS,
            },
        },
    },
});

export { sourceResolveConfig };
