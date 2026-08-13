import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { basename, dirname, join } from "node:path";

const STAGING_SUFFIX = ".tmp-";

const stagingPrefix = (target: string): string => `${target}${STAGING_SUFFIX}`;

const sweepStagingDirs = (prefixPath: string): void => {
    const parentDir = dirname(prefixPath);

    if (!existsSync(parentDir)) {
        return;
    }

    const prefix = basename(prefixPath);

    for (const entry of readdirSync(parentDir)) {
        if (entry.startsWith(prefix)) {
            rmSync(join(parentDir, entry), { recursive: true, force: true });
        }
    }
};

const createStagingDir = (prefixPath: string): string => {
    mkdirSync(dirname(prefixPath), { recursive: true });
    sweepStagingDirs(prefixPath);

    return mkdtempSync(prefixPath);
};

export { createStagingDir, stagingPrefix, sweepStagingDirs };
