import { lstatSync, readFileSync, rmSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

type ProcessGroupIdentity = {
    processGroupId: number;
    leaderStartTime: string;
};

type CleanupDirectoryIdentity = {
    path: string;
    device: string;
    inode: string;
    userId: string;
};

const isProcessGroupId = (value: number): boolean => Number.isSafeInteger(value) && value > 1;

const processGroupIdentity = (processGroupId: number): ProcessGroupIdentity | undefined => {
    if (!isProcessGroupId(processGroupId)) {
        return undefined;
    }

    try {
        const stat = readFileSync(`/proc/${String(processGroupId)}/stat`, "utf8");
        const fields = stat.slice(stat.lastIndexOf(") ") + 2).split(" ");
        const actualProcessGroupId = Number(fields[2]);
        const sessionId = Number(fields[3]);
        const leaderStartTime = fields[19];

        return actualProcessGroupId === processGroupId && sessionId === processGroupId && leaderStartTime !== undefined
            ? { processGroupId, leaderStartTime }
            : undefined;
    } catch {
        return undefined;
    }
};

const isCurrentProcessGroup = (identity: ProcessGroupIdentity): boolean => {
    const current = processGroupIdentity(identity.processGroupId);

    return current?.leaderStartTime === identity.leaderStartTime;
};

const killProcessGroup = (identity: ProcessGroupIdentity, signal: NodeJS.Signals = "SIGKILL"): void => {
    if (!isCurrentProcessGroup(identity)) {
        return;
    }

    try {
        process.kill(-identity.processGroupId, signal);
    } catch {
        return;
    }
};

const cleanupDirectoryIdentity = (path: string): CleanupDirectoryIdentity | undefined => {
    const absolutePath = resolve(path);

    if (absolutePath === "/" || !isAbsolute(path)) {
        return undefined;
    }

    try {
        const entry = lstatSync(absolutePath, { bigint: true });

        return entry.isDirectory()
            ? {
                    path: absolutePath,
                    device: entry.dev.toString(),
                    inode: entry.ino.toString(),
                    userId: entry.uid.toString(),
                }
            : undefined;
    } catch {
        return undefined;
    }
};

const removeCleanupDirectory = (identity: CleanupDirectoryIdentity): void => {
    const current = cleanupDirectoryIdentity(identity.path);

    if (
        current?.device !== identity.device ||
        current.inode !== identity.inode ||
        current.userId !== identity.userId
    ) {
        return;
    }

    try {
        rmSync(identity.path, { recursive: true, force: true });
    } catch {
        return;
    }
};

export {
    type CleanupDirectoryIdentity,
    cleanupDirectoryIdentity,
    killProcessGroup,
    type ProcessGroupIdentity,
    processGroupIdentity,
    removeCleanupDirectory,
};
