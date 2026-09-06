import { stageProjectFonts } from "../internal/font-staging.js";
import { prependXdgDataDir } from "../internal/xdg-data-dirs.js";

const prepareDevFontDir = (root: string): string => {
    const shareDir = stageProjectFonts(root);
    process.env.XDG_DATA_DIRS = prependXdgDataDir(shareDir, process.env.XDG_DATA_DIRS);

    return shareDir;
};

export { prepareDevFontDir };
