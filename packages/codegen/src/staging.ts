import { mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { basename, dirname, join } from "node:path";

const STAGING_SUFFIX = ".tmp-";
const OWNER_PATTERN = /^(?<pid>\d+)-/;

const errorCode = (error: unknown): string | undefined =>
    error instanceof Error && "code" in error && typeof error.code === "string" ? error.code : undefined;

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

const sweepStrandedDirs = (parentDir: string, prefix: string): void => {
    for (const entry of readEntries(parentDir)) {
        if (isStranded(entry, prefix)) {
            removeStrandedDir(join(parentDir, entry));
        }
    }
};

const sweepStagingDirs = (target: string): void => {
    sweepStrandedDirs(dirname(target), `${basename(target)}${STAGING_SUFFIX}`);
};

const createStagingDir = (target: string): string => {
    mkdirSync(dirname(target), { recursive: true });
    sweepStagingDirs(target);

    return mkdtempSync(`${target}${STAGING_SUFFIX}${String(process.pid)}-`);
};

export { createStagingDir, sweepStagingDirs, sweepStrandedDirs };
