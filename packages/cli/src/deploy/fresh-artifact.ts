import { lstatSync, rmSync } from "node:fs";
import { join } from "node:path";

const PATH_SEPARATOR = /[\\/]/;

const artifactTarget = (output: string, fileName: string): string => {
    if (fileName === "." || fileName === ".." || fileName.length === 0 || PATH_SEPARATOR.test(fileName)) {
        throw new TypeError(`The artifact name must be a file name, received ${fileName}`);
    }

    return join(output, fileName);
};

const removeArtifact = (target: string): void => {
    rmSync(target, { force: true, recursive: true });
};

const artifactSize = (target: string): number => {
    const stats = lstatSync(target, { throwIfNoEntry: false });

    if (stats === undefined || !stats.isFile() || stats.size === 0) {
        throw new Error(`The package tool wrote no non-empty regular file at ${target}`);
    }

    return stats.size;
};

const writeFreshArtifact = (target: string, write: () => void): number => {
    removeArtifact(target);

    try {
        write();

        return artifactSize(target);
    } catch (error) {
        removeArtifact(target);
        throw error;
    }
};

export { artifactTarget, writeFreshArtifact };
