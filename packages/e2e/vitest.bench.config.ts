import { fileURLToPath } from "node:url";
import codspeedPlugin from "@codspeed/vitest-plugin";
import gtkx from "@gtkx/vitest";
import { defineConfig } from "vitest/config";

const reactSrc = fileURLToPath(new URL("../react/src/index.ts", import.meta.url));

/**
 * Benchmark configuration kept separate from the test config so the CodSpeed
 * instrument plugin only loads for `vitest bench`. The plugin is inert outside
 * CI; under the CodSpeed runner it counts instructions for a deterministic,
 * runner-independent regression gate over the reconciler hot paths.
 */
export default defineConfig({
    plugins: [gtkx(), codspeedPlugin()],
    resolve: {
        alias: {
            "@gtkx/react": reactSrc,
        },
    },
    test: {
        name: "e2e-bench",
        setupFiles: ["./tests/setup.ts"],
        benchmark: {
            include: ["tests/bench/**/*.bench.{ts,tsx}"],
        },
    },
});
