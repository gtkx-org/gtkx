import { homedir } from "node:os";
import { join } from "node:path";

const CACHE_NAMESPACE = "gtkx";

const cacheRoot = (): string => {
    const base = process.env.XDG_CACHE_HOME;

    return join(base !== undefined && base.length > 0 ? base : join(homedir(), ".cache"), CACHE_NAMESPACE);
};

export { cacheRoot };
