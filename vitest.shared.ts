import { defineConfig } from "vitest/config";

const inlineDepsPatterns: RegExp[] = [/@gtkx\/(?!native)/, /[/\\]\.gtkx[/\\]/];

export default defineConfig({
    ssr: {
        resolve: {
            conditions: ["source", "module", "node", "development|production"],
        },
    },
    test: {
        server: {
            deps: {
                inline: [...inlineDepsPatterns],
            },
        },
    },
});
