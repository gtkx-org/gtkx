import { mkdirSync, symlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { relativeIconPath, type ResolvedIconSource, resolveIconSource } from "../internal/icon-path.js";
import { createRetainedStagingDir } from "../internal/staging-dir.js";
import { prependXdgDataDir } from "../internal/xdg-data-dirs.js";

const stageIconSource = (shareDir: string, applicationId: string, source: ResolvedIconSource): void => {
    if (source.iconsDir !== null) {
        symlinkSync(source.iconsDir, join(shareDir, "icons"), "dir");

        return;
    }

    if (source.iconFile === null) {
        return;
    }

    const target = join(shareDir, "icons", relativeIconPath(applicationId, source.iconFile));
    mkdirSync(dirname(target), { recursive: true });
    symlinkSync(source.iconFile, target, "file");
};

const prepareDevIconDir = (
    root: string,
    applicationId: string,
    configured: string | undefined,
): string | null => {
    const source = resolveIconSource(root, configured);

    if (source.iconsDir === null && source.iconFile === null) {
        return null;
    }

    const shareDir = createRetainedStagingDir("icons").retain();
    stageIconSource(shareDir, applicationId, source);
    process.env.XDG_DATA_DIRS = prependXdgDataDir(shareDir, process.env.XDG_DATA_DIRS);

    return shareDir;
};

export { prepareDevIconDir };
