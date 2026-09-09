import { enableCompileCache } from "node:module";
import { join } from "node:path";
import { cacheRoot } from "./cache-root.js";

const COMPILE_CACHE_SEGMENT = "node";
const DISABLE_COMPILE_CACHE_ENV = "GTKX_DISABLE_COMPILE_CACHE";

const enableToolchainCompileCache = (): void => {
    if (process.env[DISABLE_COMPILE_CACHE_ENV] === "1") {
        return;
    }

    enableCompileCache(join(cacheRoot(), COMPILE_CACHE_SEGMENT));
};

export { enableToolchainCompileCache };
