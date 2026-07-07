import { defineConfig } from "vitest/config";

/**
 * Source-first module resolution for this monorepo's test suites: workspace
 * packages resolve to their TypeScript sources through the `source` export
 * condition, and every GTKX package plus the generated binding stores are
 * inlined into the Vite module graph so those sources get transformed.
 */
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
