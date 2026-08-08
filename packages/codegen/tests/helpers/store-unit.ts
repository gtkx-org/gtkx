import { join } from "node:path";
import type { StoreOptions } from "../../src/store/store-fs.js";

const storeUnit = (nodeModules: string, name: "gi" | "jsx"): StoreOptions => ({
    storeDir: join(nodeModules, ".gtkx", name),
    linkDir: join(nodeModules, "@gtkx", name),
    version: "0.0.0",
});

export { storeUnit };
