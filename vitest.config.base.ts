import { availableParallelism } from "node:os";
import { defineConfig } from "vitest/config";

const INLINE_DEPS: RegExp[] = [/@gtkx\/(?!native)/, /[/\\]\.gtkx[/\\]/];
const CPUS_PER_WORKER = 4;
const configuredWorkers = Number(process.env.GTKX_MAX_WORKERS);
const defaultWorkers = Math.max(1, Math.floor(availableParallelism() / CPUS_PER_WORKER));

const maxWorkers = Number.isSafeInteger(configuredWorkers) && configuredWorkers > 0
    ? configuredWorkers
    : defaultWorkers;

const sourceResolveConfig = defineConfig({
    ssr: {
        resolve: {
            conditions: ["source", "module", "node", "development|production"],
        },
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
