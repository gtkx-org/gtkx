import { errorCode } from "@gtkx/utils";
import { lstatSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { basename, dirname, join } from "node:path";

const STAGING_SUFFIX = ".tmp-";
const OWNER_PATTERN = /^(?<pid>\d+)-/;

const isOwnerRunning = (pid: number): boolean => {
    if (!Number.isSafeInteger(pid) || pid <= 0) {
        return false;
    }

    try {
        process.kill(pid, 0);

        return true;
    } catch (error) {
        return errorCode(error) === "EPERM";
    }
};

const isStranded = (entry: string, prefix: string): boolean => {
    if (!entry.startsWith(prefix)) {
        return false;
    }

    const owner = OWNER_PATTERN.exec(entry.slice(prefix.length))?.groups?.pid;

    return owner === undefined || !isOwnerRunning(Number(owner));
};

const readEntries = (parentDir: string): string[] => {
    try {
        return readdirSync(parentDir);
    } catch {
        return [];
    }
};

const removeStrandedDir = (path: string): void => {
    try {
        rmSync(path, { recursive: true, force: true });
    } catch {
        return;
    }
};

const assertRegularDirectory = (path: string): void => {
    const stats = lstatSync(path, { throwIfNoEntry: false });

    if (stats !== undefined && !stats.isDirectory()) {
        throw new Error(`Cannot use ${path} as a generated-store directory`);
    }
};

const sweepStrandedDirs = (parentDir: string, prefix: string): void => {
    for (const entry of readEntries(parentDir)) {
        if (isStranded(entry, prefix)) {
            removeStrandedDir(join(parentDir, entry));
        }
    }
};

const sweepStagingDirs = (target: string): void => {
    const parent = dirname(target);
    assertRegularDirectory(parent);
    sweepStrandedDirs(parent, `${basename(target)}${STAGING_SUFFIX}`);
};

const createStagingDir = (target: string): string => {
    const parent = dirname(target);
    assertRegularDirectory(parent);
    mkdirSync(parent, { recursive: true });
    assertRegularDirectory(parent);
    sweepStagingDirs(target);

    return mkdtempSync(`${target}${STAGING_SUFFIX}${String(process.pid)}-`);
};

export { createStagingDir, sweepStagingDirs, sweepStrandedDirs };
