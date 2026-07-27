import { existsSync } from "node:fs";
import { join } from "node:path";
import { prependXdgDataDir } from "../internal/xdg-data-dirs.js";

const prepareDevIconDir = (root: string, dataDir: string | null): string | null => {
    if (dataDir === null) {
        return null;
    }

    const shareDir = join(root, dataDir);

    if (!existsSync(join(shareDir, "icons"))) {
        return null;
    }

    process.env.XDG_DATA_DIRS = prependXdgDataDir(shareDir, process.env.XDG_DATA_DIRS);

    return shareDir;
};

export { prepareDevIconDir };
