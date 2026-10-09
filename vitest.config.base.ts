import { availableParallelism } from "node:os";
import { defineConfig } from "vitest/config";
import { workspaceAliases } from "./scripts/workspace-paths.js";

const INLINE_DEPS: RegExp[] = [/@gtkx\/(?!native)/, /[/\\]\.gtkx[/\\]/];
const CPUS_PER_WORKER = 4;
const configuredWorkers = Number(process.env.GTKX_MAX_WORKERS);
const defaultWorkers = Math.max(1, Math.floor(availableParallelism() / CPUS_PER_WORKER));

const maxWorkers =
    Number.isSafeInteger(configuredWorkers) && configuredWorkers > 0 ? configuredWorkers : defaultWorkers;

const sourceResolveConfig = defineConfig({
    resolve: {
        alias: [...workspaceAliases].map(([specifier, replacement]) => ({
            find: new RegExp(`^${RegExp.escape(specifier)}$`),
            replacement,
        })),
    },
    test: {
        maxWorkers,
        server: {
            deps: {
                inline: INLINE_DEPS,
            },
        },
    },
});

export { sourceResolveConfig };
