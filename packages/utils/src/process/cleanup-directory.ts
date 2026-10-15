import { lstatSync, rmSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

type CleanupDirectoryIdentity = {
    path: string;
    device: string;
    inode: string;
    userId: string;
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

    if (current?.device !== identity.device || current.inode !== identity.inode || current.userId !== identity.userId) {
        return;
    }

    try {
        rmSync(identity.path, { recursive: true, force: true });
    } catch {
        return;
    }
};

export { type CleanupDirectoryIdentity, cleanupDirectoryIdentity, removeCleanupDirectory };
