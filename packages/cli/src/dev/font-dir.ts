import { stageProjectFonts } from "../internal/font-staging.js";
import type { RetainedStagingDir } from "../internal/staging-dir.js";
import { prependXdgDataDir } from "../internal/xdg-data-dirs.js";

const prepareDevFontDir = (root: string, staging: RetainedStagingDir): string => {
    const shareDir = stageProjectFonts(root, staging);
    process.env.XDG_DATA_DIRS = prependXdgDataDir(shareDir, process.env.XDG_DATA_DIRS);

    return shareDir;
};

export { prepareDevFontDir };
