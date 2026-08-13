import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

type RetainedStagingDir = {
    getPath: () => string | null;
    adopt: (dir: string) => string;
    retain: () => string;
    release: () => void;
};

const removeTempDir = (dir: string): void => {
    rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
};

const createStagingDir = (prefix: string): string => mkdtempSync(join(tmpdir(), `gtkx-${prefix}-`));

const withStagingDir = <T>(prefix: string, produce: (dir: string) => T): T => {
    const dir = createStagingDir(prefix);

    try {
        return produce(dir);
    } finally {
        removeTempDir(dir);
    }
};

const createRetainedStagingDir = (prefix: string): RetainedStagingDir => {
    let path: string | null = null;
    let cleanupProcessExit: (() => void) | null = null;

    const release = (): void => {
        if (path !== null && cleanupProcessExit) {
            removeTempDir(path);
            process.removeListener("exit", cleanupProcessExit);
            cleanupProcessExit = null;
        }

        path = null;
    };

    const retain = (): string => {
        if (path !== null) {
            return path;
        }

        const dir = createStagingDir(prefix);
        path = dir;

        cleanupProcessExit = (): void => {
            removeTempDir(dir);
        };

        process.once("exit", cleanupProcessExit);

        return dir;
    };

    const adopt = (dir: string): string => {
        release();
        path = dir;

        return dir;
    };

    return {
        getPath: () => path,
        adopt,
        retain,
        release,
    };
};

export { createRetainedStagingDir, removeTempDir, type RetainedStagingDir, withStagingDir };
