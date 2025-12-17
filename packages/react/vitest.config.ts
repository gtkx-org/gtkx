import { mergeConfig } from "vitest/config";
import baseConfig from "../../vitest.config.js";

export default mergeConfig(baseConfig, {
    test: {
        setupFiles: [import.meta.resolve("./tests/setup.ts")],
    },
});
