import { errorCode } from "@gtkx/utils";
import { renameSync, rmSync, writeFileSync } from "node:fs";

const STAGING_SUFFIX = ".tmp";
const STAGING_OWNER_RE = /\.(\d+)\.\d+\.tmp$/;
const FOREIGN_OWNER_CODE = "EPERM";
const staging = { count: 0 };

const stagingPath = (path: string): string => {
    staging.count += 1;

    return `${path}.${String(process.pid)}.${String(staging.count)}${STAGING_SUFFIX}`;
};

const isStagingOwnerRunning = (name: string): boolean => {
    const owner = STAGING_OWNER_RE.exec(name);

    if (owner === null) {
        return false;
    }

    try {
        process.kill(Number(owner[1]), 0);

        return true;
    } catch (error) {
        return errorCode(error) === FOREIGN_OWNER_CODE;
    }
};

const writeAtomically = (path: string, contents: string): void => {
    const temporary = stagingPath(path);

    try {
        writeFileSync(temporary, contents);
        renameSync(temporary, path);
    } catch {
        rmSync(temporary, { force: true });
    }
};

export { isStagingOwnerRunning, STAGING_SUFFIX, stagingPath, writeAtomically };
