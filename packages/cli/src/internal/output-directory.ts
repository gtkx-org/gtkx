import {
    cpSync,
    lstatSync,
    mkdirSync,
    mkdtempDisposableSync,
    readFileSync,
    renameSync,
    rmSync,
} from "node:fs";
import { dirname, join, relative, sep } from "node:path";

type OutputDirectoryOptions = {
    preservedEntries?: readonly string[];
};

type DisposableDirectory = ReturnType<typeof mkdtempDisposableSync>;

type OutputDirectoryTransaction = Disposable & {
    commit: () => void;
    path: string;
};

type OutputDirectoryTransactionRequest = {
    hasPrevious: boolean;
    path: string;
    previous: string;
    temporary: DisposableDirectory;
};

const hasSymlinkComponent = (root: string, target: string): boolean => {
    let current = root;

    for (const segment of relative(root, target).split(sep)) {
        current = join(current, segment);

        if (lstatSync(current, { throwIfNoEntry: false })?.isSymbolicLink() === true) {
            return true;
        }
    }

    return false;
};

const readRegularFile = (path: string): string | null => {
    try {
        if (!lstatSync(path).isFile()) {
            return null;
        }

        return readFileSync(path, "utf8");
    } catch {
        return null;
    }
};

const copyPreservedEntries = (previous: string, path: string, preservedEntries: readonly string[]): void => {
    for (const name of preservedEntries) {
        const source = join(previous, name);

        if (lstatSync(source, { throwIfNoEntry: false }) !== undefined) {
            cpSync(source, join(path, name), { recursive: true });
        }
    }
};

const capturePreviousOutput = (
    path: string,
    previous: string,
    hasPrevious: boolean,
): void => {
    mkdirSync(dirname(path), { recursive: true });

    if (hasPrevious) {
        renameSync(path, previous);
    }
};

const createFreshOutput = (
    path: string,
    previous: string,
    hasPrevious: boolean,
    preservedEntries: readonly string[],
): void => {
    mkdirSync(path);

    if (hasPrevious) {
        copyPreservedEntries(previous, path, preservedEntries);
    }
};

const restoreOutputDirectory = (
    path: string,
    previous: string,
    hasPrevious: boolean,
    temporary: DisposableDirectory,
): void => {
    rmSync(path, { recursive: true, force: true });

    if (hasPrevious) {
        renameSync(previous, path);
    }

    temporary.remove();
};

const createOutputDirectoryTransaction = (
    request: OutputDirectoryTransactionRequest,
): OutputDirectoryTransaction => {
    const { hasPrevious, path, previous, temporary } = request;
    let isFinished = false;

    return {
        path,
        commit: () => {
            isFinished = true;
            temporary.remove();
        },
        [Symbol.dispose]: () => {
            if (isFinished) {
                return;
            }

            isFinished = true;
            restoreOutputDirectory(path, previous, hasPrevious, temporary);
        },
    };
};

const prepareOutputDirectory = (
    root: string,
    path: string,
    options: OutputDirectoryOptions = {},
): OutputDirectoryTransaction => {
    const temporary = mkdtempDisposableSync(join(root, ".gtkx-output-"));
    const previous = join(temporary.path, "previous");
    const hasPrevious = lstatSync(path, { throwIfNoEntry: false }) !== undefined;
    const preservedEntries = options.preservedEntries ?? [];

    try {
        capturePreviousOutput(path, previous, hasPrevious);
    } catch (error) {
        temporary.remove();
        throw error;
    }

    try {
        createFreshOutput(path, previous, hasPrevious, preservedEntries);
    } catch (error) {
        restoreOutputDirectory(path, previous, hasPrevious, temporary);
        throw error;
    }

    return createOutputDirectoryTransaction({
        path,
        previous,
        hasPrevious,
        temporary,
    });
};

export {
    type OutputDirectoryTransaction,
    hasSymlinkComponent,
    prepareOutputDirectory,
    readRegularFile,
};
