import { enableCompileCache } from "node:module";
import { join } from "node:path";
import { cacheRoot } from "./cache-root.js";

const COMPILE_CACHE_SEGMENT = "compile-cache";

const enableToolchainCompileCache = (): void => {
    enableCompileCache(join(cacheRoot(), COMPILE_CACHE_SEGMENT));
};

export { COMPILE_CACHE_SEGMENT, enableToolchainCompileCache };
