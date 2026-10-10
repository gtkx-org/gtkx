import { defineConfig } from "vitest/config";
import { workspaceAliases } from "./scripts/workspace-paths.js";

const INLINE_DEPS: RegExp[] = [/@gtkx\/(?!native)/, /[/\\]\.gtkx[/\\]/];

const sourceResolveConfig = defineConfig({
    resolve: {
        alias: [...workspaceAliases].map(([specifier, replacement]) => ({
            find: new RegExp(`^${RegExp.escape(specifier)}$`),
            replacement,
        })),
    },
    test: {
        server: {
            deps: {
                inline: INLINE_DEPS,
            },
        },
    },
});

export { sourceResolveConfig };
