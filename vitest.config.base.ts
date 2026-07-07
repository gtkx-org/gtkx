import { defineConfig } from "vitest/config";

export const sourceResolveConfig = defineConfig({
    ssr: {
        resolve: {
            conditions: ["source", "module", "node", "development|production"],
        },
    },
    test: {
        server: {
            deps: {
                inline: [/@gtkx\/(?!native)/, /[/\\]\.gtkx[/\\]/],
            },
        },
    },
});
