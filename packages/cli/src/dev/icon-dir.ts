import { mkdirSync, symlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import {
    relativeIconPath,
    resolveApplicationIcon,
    type ResolvedApplicationIcon,
} from "../internal/icon-path.js";
import { createRetainedStagingDir } from "../internal/staging-dir.js";
import { prependXdgDataDir } from "../internal/xdg-data-dirs.js";

const stageIconSource = (shareDir: string, applicationId: string, source: ResolvedApplicationIcon): void => {
    if (source.kind === "theme") {
        symlinkSync(source.path, join(shareDir, "icons"), "dir");

        return;
    }

    if (source.kind === "none") {
        return;
    }

    const target = join(shareDir, "icons", relativeIconPath(applicationId, source.path));
    mkdirSync(dirname(target), { recursive: true });
    symlinkSync(source.path, target, "file");
};

const prepareDevIconDir = (
    root: string,
    applicationId: string,
    configured: string | undefined,
): string | null => {
    const source = resolveApplicationIcon(root, applicationId, configured);

    if (source.kind === "none") {
        return null;
    }

    const shareDir = createRetainedStagingDir("icons").retain();
    stageIconSource(shareDir, applicationId, source);
    process.env.XDG_DATA_DIRS = prependXdgDataDir(shareDir, process.env.XDG_DATA_DIRS);

    return shareDir;
};

export { prepareDevIconDir };
