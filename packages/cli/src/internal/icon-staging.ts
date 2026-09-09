import { mkdirSync, rmSync, symlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { relativeIconPath, resolveApplicationIcon, type ResolvedApplicationIcon } from "./icon-path.js";
import { createRetainedStagingDir, type RetainedStagingDir } from "./staging-dir.js";

const ICONS_DIR = "icons";
const stagingDirs: Map<string, RetainedStagingDir> = new Map();

const stagingFor = (root: string): RetainedStagingDir => {
    const existing = stagingDirs.get(root);

    if (existing !== undefined) {
        return existing;
    }

    const staging = createRetainedStagingDir("icons");
    stagingDirs.set(root, staging);

    return staging;
};

const resetIconsDir = (shareDir: string): string => {
    const iconsDir = join(shareDir, ICONS_DIR);
    rmSync(iconsDir, { recursive: true, force: true });

    return iconsDir;
};

const stageIconSource = (iconsDir: string, applicationId: string, source: ResolvedApplicationIcon): void => {
    if (source.kind === "theme") {
        symlinkSync(source.path, iconsDir, "dir");

        return;
    }

    if (source.kind === "none") {
        return;
    }

    const target = join(iconsDir, relativeIconPath(applicationId, source.path));
    mkdirSync(dirname(target), { recursive: true });
    symlinkSync(source.path, target, "file");
};

const stageProjectIcons = (root: string, applicationId: string, configured: string | undefined): string | null => {
    const source = resolveApplicationIcon(root, applicationId, configured);

    if (source.kind === "none") {
        return null;
    }

    const shareDir = stagingFor(root).retain();
    stageIconSource(resetIconsDir(shareDir), applicationId, source);

    return shareDir;
};

export { stageProjectIcons };
