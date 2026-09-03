import {
    closeSync,
    constants,
    fstatSync,
    lstatSync,
    mkdirSync,
    mkdtempSync,
    openSync,
    readdirSync,
    readFileSync,
    realpathSync,
    renameSync,
    rmdirSync,
    rmSync,
} from "node:fs";
import { basename, dirname, isAbsolute, join, relative, sep } from "node:path";

type DirectoryIdentity = { device: bigint; inode: bigint };
type DirectoryLease = { identity: DirectoryIdentity; path: string; release: () => void };
type DirectoryValidator = (path: string) => boolean;
type QuarantineDirectory = { displayPath: string; path: string; remove: () => void; release: () => void };
type CommitOutputRequest = {
    freshIdentity: DirectoryIdentity;
    preservedNames: ReadonlySet<string>;
    previous: string | null;
    quarantine: QuarantineDirectory;
    target: string;
};
type InstallFreshOutputRequest = Omit<CommitOutputRequest, "freshIdentity" | "previous"> & {
    fresh: string;
    previous: string;
};
type RenameOperation = { destination: string; source: string };
type RecoverCommitRequest = InstallFreshOutputRequest & {
    backup: string;
    error: unknown;
    operations: RenameOperation[];
};
type OverlayEntryRequest = RenameOperation & { backup: string; operations: RenameOperation[] };
type OutputDirectoryTransaction = Disposable & {
    commit: (preservedNames?: ReadonlySet<string>, isFresh?: DirectoryValidator) => void;
    path: string;
};
type PreparedOutputDirectory = { status: "prepared"; transaction: OutputDirectoryTransaction } | { status: "unsafe" };
type PreparationResources = {
    parent: DirectoryLease;
    previous: string | null;
    publicParent: string;
    publicPath: string;
    publicRoot: string;
    quarantine: QuarantineDirectory;
    root: DirectoryLease;
    target: string;
};
type TransactionRequest = PreparationResources & { fresh: DirectoryLease };
type TransactionState = "committed" | "prepared" | "retained" | "rolled-back";

const hasErrorCode = (value: unknown, code: string): boolean =>
    typeof value === "object" && value !== null && "code" in value && value.code === code;

const readRegularFile = (path: string): string | null => {
    let descriptor: number | null = null;

    try {
        descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);

        if (!fstatSync(descriptor).isFile()) {
            return null;
        }

        return readFileSync(descriptor, "utf8");
    } catch {
        return null;
    } finally {
        if (descriptor !== null) {
            closeSync(descriptor);
        }
    }
};

const openDirectoryLease = (path: string): DirectoryLease | null => {
    let descriptor: number | null = null;

    try {
        descriptor = openSync(path, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
        const stats = fstatSync(descriptor, { bigint: true });
        let retainedDescriptor: number | null = descriptor;

        return {
            identity: { device: stats.dev, inode: stats.ino },
            path: join("/proc/self/fd", String(descriptor)),
            release: () => {
                if (retainedDescriptor === null) {
                    return;
                }

                const releasedDescriptor = retainedDescriptor;
                retainedDescriptor = null;
                closeSync(releasedDescriptor);
            },
        };
    } catch {
        if (descriptor !== null) {
            closeSync(descriptor);
        }

        return null;
    }
};

const readDirectoryIdentity = (path: string): DirectoryIdentity | null => {
    const lease = openDirectoryLease(path);

    if (lease === null) {
        return null;
    }

    lease.release();

    return lease.identity;
};

const hasDirectoryIdentity = (path: string, expected: DirectoryIdentity): boolean => {
    const actual = readDirectoryIdentity(path);

    return actual !== null && actual.device === expected.device && actual.inode === expected.inode;
};

const hasResolvedDirectoryIdentity = (path: string, expected: DirectoryIdentity): boolean => {
    try {
        return hasDirectoryIdentity(realpathSync(path), expected);
    } catch {
        return false;
    }
};

const capturePath = (source: string, destination: string): "captured" | "missing" => {
    try {
        renameSync(source, destination);

        return "captured";
    } catch (error) {
        if (hasErrorCode(error, "ENOENT")) {
            return "missing";
        }

        throw error;
    }
};

const createQuarantineDirectory = (parent: DirectoryLease, displayParent: string): QuarantineDirectory => {
    const created = mkdtempSync(join(parent.path, ".gtkx-output-"));
    const name = basename(created);
    const entry = join(parent.path, name);
    const lease = openDirectoryLease(entry);

    if (lease === null) {
        rmdirSync(entry);
        throw new Error("Could not secure the output quarantine directory");
    }

    return {
        displayPath: join(displayParent, name),
        path: lease.path,
        release: lease.release,
        remove: () => {
            if (!hasDirectoryIdentity(entry, lease.identity)) {
                throw new Error(`The output quarantine changed; retained files are in ${join(displayParent, name)}`);
            }

            rmdirSync(entry);
        },
    };
};

const releaseTransactionLeases = (
    fresh: DirectoryLease,
    quarantine: QuarantineDirectory,
    parent: DirectoryLease,
    root: DirectoryLease,
): void => {
    try {
        fresh.release();
    } finally {
        try {
            quarantine.release();
        } finally {
            try {
                parent.release();
            } finally {
                root.release();
            }
        }
    }
};

const releasePreparationLeases = (
    quarantine: QuarantineDirectory,
    parent: DirectoryLease,
    root: DirectoryLease,
): void => {
    try {
        quarantine.release();
    } finally {
        try {
            parent.release();
        } finally {
            root.release();
        }
    }
};

const movePath = (source: string, destination: string, operations: RenameOperation[]): void => {
    renameSync(source, destination);
    operations.push({ source, destination });
};

const moveNames = (source: string, destination: string, names: string[], operations: RenameOperation[]): void => {
    for (const name of names) {
        movePath(join(source, name), join(destination, name), operations);
    }
};

const reverseOperations = (operations: RenameOperation[]): void => {
    for (const operation of operations.toReversed()) {
        renameSync(operation.destination, operation.source);
    }
};

const overlayDirectory = (
    source: string,
    destination: string,
    backup: string,
    operations: RenameOperation[],
): void => {
    for (const name of readdirSync(source)) {
        overlayEntry({
            source: join(source, name),
            destination: join(destination, name),
            backup: join(backup, name),
            operations,
        });
    }
};

const overlayEntry = (request: OverlayEntryRequest): void => {
    const destinationStats = lstatSync(request.destination, { throwIfNoEntry: false });

    if (destinationStats === undefined) {
        movePath(request.source, request.destination, request.operations);

        return;
    }

    const sourceStats = lstatSync(request.source);

    if (sourceStats.isDirectory() && destinationStats.isDirectory()) {
        overlayDirectory(request.source, request.destination, request.backup, request.operations);

        return;
    }

    if (!sourceStats.isFile() || !destinationStats.isFile()) {
        throw new Error("Cannot merge conflicting preserved output entries");
    }

    mkdirSync(dirname(request.backup), { recursive: true });
    movePath(request.destination, request.backup, request.operations);
    movePath(request.source, request.destination, request.operations);
};

const restoreUnexpectedOutput = (
    unexpected: string,
    target: string,
    quarantine: QuarantineDirectory,
    previous: string | null,
): never => {
    try {
        renameSync(unexpected, target);

        if (previous === null) {
            quarantine.remove();
        }
    } catch (error) {
        throw new Error(`Output recovery failed; retained files are in ${quarantine.displayPath}`, { cause: error });
    }

    throw new Error(
        `Output changed during the operation; the previous output is retained in ${quarantine.displayPath}`,
    );
};

const recoverUnsecuredPublicPath = (
    target: string,
    quarantine: QuarantineDirectory,
    previous: string | null,
    error: unknown,
): never => {
    const unsecured = join(quarantine.path, "unsecured");
    const publicCapture = capturePath(target, unsecured);

    try {
        if (previous !== null) {
            renameSync(previous, target);
        } else if (publicCapture === "captured") {
            renameSync(unsecured, target);
        }

        if (previous === null || publicCapture === "missing") {
            quarantine.remove();
        }
    } catch (recoveryError) {
        throw new AggregateError(
            [error, recoveryError],
            `Could not recover the output directory; retained files are in ${quarantine.displayPath}`,
            { cause: recoveryError },
        );
    }

    throw new Error(`Could not secure the output directory; retained files are in ${quarantine.displayPath}`, {
        cause: error,
    });
};

const recoverFailedCapture = (quarantine: QuarantineDirectory, error: unknown): never => {
    try {
        quarantine.remove();
    } catch (recoveryError) {
        throw new AggregateError(
            [error, recoveryError],
            `Could not clean the output quarantine; retained files are in ${quarantine.displayPath}`,
            { cause: recoveryError },
        );
    }

    throw error;
};

const rollbackOutputDirectory = (
    target: string,
    quarantine: QuarantineDirectory,
    previous: string | null,
    freshIdentity: DirectoryIdentity,
): void => {
    const failed = join(quarantine.path, "failed");
    const freshCapture = capturePath(target, failed);

    if (freshCapture === "captured" && !hasDirectoryIdentity(failed, freshIdentity)) {
        restoreUnexpectedOutput(failed, target, quarantine, previous);
    }

    if (previous !== null) {
        renameSync(previous, target);
    }

    if (freshCapture === "captured") {
        rmSync(failed, { recursive: true, force: true, maxRetries: 5 });
    }

    quarantine.remove();
};

const restoreMissingFreshOutput = (
    target: string,
    quarantine: QuarantineDirectory,
    previous: string | null,
): never => {
    try {
        if (previous !== null) {
            renameSync(previous, target);
        }

        quarantine.remove();
    } catch (error) {
        throw new Error(`The fresh output disappeared; retained files are in ${quarantine.displayPath}`, {
            cause: error,
        });
    }

    throw new Error("The fresh output directory disappeared before it could be committed");
};

const captureVerifiedFreshOutput = (
    target: string,
    quarantine: QuarantineDirectory,
    previous: string | null,
    freshIdentity: DirectoryIdentity,
): string => {
    const fresh = join(quarantine.path, "fresh");

    if (capturePath(target, fresh) === "missing") {
        restoreMissingFreshOutput(target, quarantine, previous);
    }

    if (!hasDirectoryIdentity(fresh, freshIdentity)) {
        restoreUnexpectedOutput(fresh, target, quarantine, previous);
    }

    return fresh;
};

const recoverCommit = (request: RecoverCommitRequest): never => {
    const { backup, error, fresh, operations, previous, quarantine, target } = request;

    try {
        reverseOperations(operations);
        renameSync(previous, target);
        rmSync(fresh, { recursive: true, force: true, maxRetries: 5 });
        rmSync(backup, { recursive: true, force: true, maxRetries: 5 });
        quarantine.remove();
    } catch (recoveryError) {
        throw new AggregateError(
            [error, recoveryError],
            `Could not restore the previous output; retained files are in ${quarantine.displayPath}`,
            { cause: recoveryError },
        );
    }

    throw error;
};

const installFreshOutput = (request: InstallFreshOutputRequest): void => {
    const { fresh, preservedNames, previous, quarantine, target } = request;
    const backup = join(quarantine.path, "backup");
    const operations: RenameOperation[] = [];

    try {
        const oldNames = readdirSync(previous).filter((name) => !preservedNames.has(name));
        const freshNames = readdirSync(fresh);
        const ordinaryFreshNames = freshNames.filter((name) => !preservedNames.has(name));
        const preservedFreshNames = freshNames.filter((name) => preservedNames.has(name));
        mkdirSync(backup);
        moveNames(previous, backup, oldNames, operations);
        moveNames(fresh, previous, ordinaryFreshNames, operations);

        for (const name of preservedFreshNames) {
            overlayEntry({
                source: join(fresh, name),
                destination: join(previous, name),
                backup: join(backup, name),
                operations,
            });
        }

        renameSync(previous, target);
    } catch (error) {
        recoverCommit({ ...request, backup, operations, error });
    }

    rmSync(fresh, { recursive: true, force: true, maxRetries: 5 });
    rmSync(backup, { recursive: true, force: true, maxRetries: 5 });
    quarantine.remove();
};

const commitOutputDirectory = (request: CommitOutputRequest): void => {
    const { freshIdentity, preservedNames, previous, quarantine, target } = request;
    const fresh = captureVerifiedFreshOutput(target, quarantine, previous, freshIdentity);

    if (previous === null) {
        renameSync(fresh, target);
        quarantine.remove();

        return;
    }

    installFreshOutput({ target, quarantine, previous, fresh, preservedNames });
};

const assertFreshOutput = (path: string, isFresh: DirectoryValidator | undefined): void => {
    if (isFresh !== undefined && !isFresh(path)) {
        throw new Error("The build did not write to the secured output directory");
    }
};

const createOutputDirectoryTransaction = (request: TransactionRequest): OutputDirectoryTransaction => {
    const { fresh, parent, previous, publicParent, publicPath, publicRoot, quarantine, root, target } = request;
    let state: TransactionState = "prepared";

    const commit = (
        preservedNames: ReadonlySet<string> = new Set(),
        isFresh?: DirectoryValidator,
    ): void => {
        if (state !== "prepared") {
            throw new Error("The output directory transaction has already finished");
        }

        if (
            !hasResolvedDirectoryIdentity(publicRoot, root.identity) ||
            !hasResolvedDirectoryIdentity(publicParent, parent.identity)
        ) {
            throw new Error(`The output parent changed; previous output is retained in ${quarantine.displayPath}`);
        }

        assertFreshOutput(target, isFresh);
        state = "retained";

        try {
            commitOutputDirectory({
                target,
                quarantine,
                previous,
                freshIdentity: fresh.identity,
                preservedNames,
            });
            state = "committed";
        } finally {
            releaseTransactionLeases(fresh, quarantine, parent, root);
        }
    };

    const rollback = (): void => {
        if (state !== "prepared") {
            return;
        }

        state = "retained";

        try {
            rollbackOutputDirectory(target, quarantine, previous, fresh.identity);
            state = "rolled-back";
        } finally {
            releaseTransactionLeases(fresh, quarantine, parent, root);
        }
    };

    return { path: publicPath, commit, [Symbol.dispose]: rollback };
};

const rollbackAfterError = (transaction: OutputDirectoryTransaction, error: unknown): never => {
    try {
        transaction[Symbol.dispose]();
    } catch (rollbackError) {
        throw new AggregateError(
            [error, rollbackError],
            "Could not roll back the output directory transaction",
            { cause: rollbackError },
        );
    }

    throw error;
};

const requireFreshDirectoryLease = (resources: PreparationResources): DirectoryLease => {
    const { parent, previous, quarantine, root, target } = resources;
    const lease = openDirectoryLease(target);

    if (lease !== null) {
        return lease;
    }

    try {
        return recoverUnsecuredPublicPath(
            target,
            quarantine,
            previous,
            new Error("Could not record the fresh output directory identity"),
        );
    } finally {
        releasePreparationLeases(quarantine, parent, root);
    }
};

const requireDirectoryLease = (path: string, message: string): DirectoryLease => {
    const lease = openDirectoryLease(path);

    if (lease === null) {
        throw new Error(message);
    }

    return lease;
};

const createChildDirectoryLease = (parent: DirectoryLease, name: string): DirectoryLease => {
    const path = join(parent.path, name);

    try {
        mkdirSync(path);
    } catch (error) {
        if (!hasErrorCode(error, "EEXIST")) {
            throw error;
        }
    }

    return requireDirectoryLease(path, "Could not secure the output parent directory");
};

const openOutputParent = (root: DirectoryLease, rootPath: string, outputPath: string): DirectoryLease => {
    const relativeParent = relative(rootPath, dirname(outputPath));

    if (relativeParent === ".." || isAbsolute(relativeParent) || relativeParent.startsWith(`..${sep}`)) {
        throw new Error("The output directory must be below the project root");
    }

    let parent = requireDirectoryLease(`${root.path}/.`, "Could not secure the project root directory");
    const segments = relativeParent.split(sep);

    try {
        for (const segment of segments) {
            if (segment.length === 0) {
                continue;
            }

            const child = createChildDirectoryLease(parent, segment);
            parent.release();
            parent = child;
        }

        return parent;
    } catch (error) {
        parent.release();
        throw error;
    }
};

const createPreparationResources = (rootPath: string, path: string): PreparationResources => {
    const canonicalRoot = realpathSync(rootPath);
    const root = requireDirectoryLease(canonicalRoot, "Could not secure the project root directory");
    let parent: DirectoryLease;

    try {
        parent = openOutputParent(root, rootPath, path);
    } catch (error) {
        root.release();
        throw error;
    }

    let quarantine: QuarantineDirectory;

    try {
        quarantine = createQuarantineDirectory(root, canonicalRoot);
    } catch (error) {
        parent.release();
        root.release();
        throw error;
    }

    const target = join(parent.path, basename(path));
    const captured = join(quarantine.path, "previous");
    let previous: string | null = null;

    try {
        previous = capturePath(target, captured) === "captured" ? captured : null;
    } catch (error) {
        try {
            recoverFailedCapture(quarantine, error);
        } finally {
            releasePreparationLeases(quarantine, parent, root);
        }
    }

    try {
        mkdirSync(target);
    } catch (error) {
        try {
            recoverUnsecuredPublicPath(target, quarantine, previous, error);
        } finally {
            releasePreparationLeases(quarantine, parent, root);
        }
    }

    return {
        target,
        publicPath: path,
        publicRoot: rootPath,
        publicParent: dirname(path),
        parent,
        quarantine,
        previous,
        root,
    };
};

const prepareOutputDirectory = (
    rootPath: string,
    path: string,
    isReusable: DirectoryValidator,
): PreparedOutputDirectory => {
    const resources = createPreparationResources(rootPath, path);
    const fresh = requireFreshDirectoryLease(resources);
    const transaction = createOutputDirectoryTransaction({ ...resources, fresh });

    try {
        if (resources.previous === null || isReusable(resources.previous)) {
            return { status: "prepared", transaction };
        }
    } catch (error) {
        rollbackAfterError(transaction, error);
    }

    transaction[Symbol.dispose]();

    return { status: "unsafe" };
};

export {
    type OutputDirectoryTransaction,
    prepareOutputDirectory,
    readRegularFile,
};
