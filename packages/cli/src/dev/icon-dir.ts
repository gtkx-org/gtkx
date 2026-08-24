import { join } from "node:path";
import { inspectProjectPath } from "../internal/project-path.js";
import { prependXdgDataDir } from "../internal/xdg-data-dirs.js";

const prepareDevIconDir = (root: string, dataDir: string | null): string | null => {
    if (dataDir === null) {
        return null;
    }

    const shareDir = join(root, dataDir);
    const iconsDir = join(shareDir, "icons");

    const stats = inspectProjectPath({
        root,
        candidate: iconsDir,
        configured: `${dataDir}/icons`,
        subject: "development icon directory",
    });

    if (stats === undefined) {
        return null;
    }

    if (!stats.isDirectory()) {
        throw new Error(`Cannot use ${iconsDir} as the development icon directory`);
    }

    process.env.XDG_DATA_DIRS = prependXdgDataDir(shareDir, process.env.XDG_DATA_DIRS);

    return shareDir;
};

export { prepareDevIconDir };
