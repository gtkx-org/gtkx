import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as net from "node:net";
import { basename, dirname, join, resolve as resolvePath } from "node:path";
import type { ConnectionRegistry } from "./connection-registry.js";
import { DEFAULT_SOCKET_PATH } from "./protocol/schemas.js";
import { connectionErrorEvent } from "./transport.js";

type ProbeOutcome = { kind: "live" } | { kind: "unknown"; code: string } | { kind: "vacant" };
type PathVerdict = ProbeOutcome | { kind: "directory" };
type ClaimOutcome = "occupied" | "published";

const PROBE_TIMEOUT_MS = 1000;
const PROBE_ATTEMPTS = 3;
const PROBE_RETRY_DELAY_MS = 50;
const CLAIM_ATTEMPTS = 3;
const CLAIM_LOCK_PREFIX = "\0gtkx-mcp-claim-";
const CLAIM_LOCK_RETRY_DELAY_MS = 25;
const CLAIM_LOCK_TIMEOUT_MS = 15_000;

const delay = (ms: number): Promise<void> =>
    new Promise((resolve) => {
        setTimeout(resolve, ms);
    });

const closeServer = (server: net.Server): Promise<void> =>
    new Promise((resolve) => {
        server.close(() => {
            resolve();
        });
    });

const digestFor = (socketPath: string): string =>
    createHash("sha256").update(resolvePath(socketPath)).digest("hex");

const privatePathFor = (socketPath: string): string => {
    const width = Math.max(1, basename(socketPath).length - 1);

    return join(dirname(socketPath), `.${digestFor(socketPath).slice(0, width)}`);
};

const bindLock = (address: string): Promise<net.Server | null> =>
    new Promise((resolve) => {
        const lock = net.createServer();
        let isBound = false;

        lock.on("error", () => {
            if (!isBound) {
                resolve(null);
            }
        });

        lock.listen(address, () => {
            isBound = true;
            resolve(lock);
        });
    });

const claimBlockedError = (socketPath: string): Error =>
    new Error(
        `Timed out waiting for another GTKX MCP server to finish claiming ${socketPath}. ` +
        "Retry once no other server is starting on that path.",
    );

const acquireClaimLock = async (socketPath: string): Promise<net.Server | null> => {
    const address = `${CLAIM_LOCK_PREFIX}${digestFor(socketPath)}`;
    const deadline = Date.now() + CLAIM_LOCK_TIMEOUT_MS;
    let lock = await bindLock(address);

    while (lock === null && Date.now() < deadline) {
        await delay(CLAIM_LOCK_RETRY_DELAY_MS);
        lock = await bindLock(address);
    }

    return lock;
};

const releaseClaimLock = async (lock: net.Server | null): Promise<void> => {
    if (lock) {
        await closeServer(lock);
    }
};

const withClaimLock = async <T>(socketPath: string, action: () => Promise<T> | T): Promise<T> => {
    const lock = await acquireClaimLock(socketPath);

    if (lock === null) {
        throw claimBlockedError(socketPath);
    }

    try {
        return await action();
    } finally {
        await closeServer(lock);
    }
};

const entryFor = (target: string): fs.Stats | null => {
    try {
        return fs.lstatSync(target);
    } catch {
        return null;
    }
};

const inodeFor = (target: string): number | null => entryFor(target)?.ino ?? null;

const outcomeForProbeError = (error: NodeJS.ErrnoException): ProbeOutcome => {
    if (error.code === "ECONNREFUSED" || error.code === "ENOENT") {
        return { kind: "vacant" };
    }

    return { kind: "unknown", code: error.code ?? error.message };
};

const probeSocket = (target: string): Promise<ProbeOutcome> =>
    new Promise((resolve) => {
        const probe = net.connect({ path: target, timeout: PROBE_TIMEOUT_MS });

        const settleWith = (outcome: ProbeOutcome): void => {
            probe.destroy();
            resolve(outcome);
        };

        probe.once("connect", () => {
            settleWith({ kind: "live" });
        });

        probe.once("timeout", () => {
            settleWith({ kind: "unknown", code: "ETIMEDOUT" });
        });

        probe.once("error", (error: NodeJS.ErrnoException) => {
            settleWith(outcomeForProbeError(error));
        });
    });

const probeUntilConclusive = async (target: string): Promise<ProbeOutcome> => {
    let outcome = await probeSocket(target);

    for (let attempt = 1; attempt < PROBE_ATTEMPTS && outcome.kind === "unknown"; attempt += 1) {
        await delay(PROBE_RETRY_DELAY_MS);
        outcome = await probeSocket(target);
    }

    return outcome;
};

const alreadyOwnedError = (socketPath: string): Error =>
    new Error(
        `Another GTKX MCP server already owns ${socketPath}. ` +
        "Stop the other server (for example, the GTKX MCP server of another active session) and reconnect.",
    );

const undecidedOwnerError = (socketPath: string, code: string): Error =>
    new Error(
        `Could not tell whether another GTKX MCP server owns ${socketPath}: probing it failed with ${code}. ` +
        "Leaving the socket in place instead of removing one that may still be serving another session. " +
        "Retry, or delete the file by hand once no server is running.",
    );

const directoryPathError = (socketPath: string): Error =>
    new Error(
        `The GTKX MCP socket path ${socketPath} is a directory, not a socket. ` +
        "Remove it, or point XDG_RUNTIME_DIR at a directory where GTKX can create its socket.",
    );

const listenFailureError = (socketPath: string, code: string): Error =>
    new Error(
        `Could not create the GTKX MCP socket at ${socketPath}: listening failed with ${code}. ` +
        "Check that its directory exists and is writable.",
    );

const removeEntry = (target: string, inode: number): void => {
    if (inodeFor(target) === inode) {
        fs.rmSync(target, { force: true });
    }
};

const clearStalePath = async (target: string): Promise<PathVerdict> => {
    const entry = entryFor(target);

    if (entry === null) {
        return { kind: "vacant" };
    }

    if (entry.isDirectory()) {
        return { kind: "directory" };
    }

    const outcome = await probeUntilConclusive(target);

    if (outcome.kind === "vacant") {
        removeEntry(target, entry.ino);
    }

    return outcome;
};

const requireVacantPath = async (socketPath: string): Promise<void> => {
    const verdict = await clearStalePath(socketPath);

    if (verdict.kind === "live") {
        throw alreadyOwnedError(socketPath);
    }

    if (verdict.kind === "directory") {
        throw directoryPathError(socketPath);
    }

    if (verdict.kind === "unknown") {
        throw undecidedOwnerError(socketPath, verdict.code);
    }
};

const claimSocketPath = (privatePath: string, socketPath: string): ClaimOutcome => {
    try {
        fs.linkSync(privatePath, socketPath);

        return "published";
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "EEXIST") {
            return "occupied";
        }

        throw error;
    }
};

const publishSocket = async (privatePath: string, socketPath: string): Promise<number | null> => {
    for (let attempt = 1; attempt <= CLAIM_ATTEMPTS; attempt += 1) {
        await requireVacantPath(socketPath);

        if (claimSocketPath(privatePath, socketPath) === "published") {
            const inode = inodeFor(socketPath);
            fs.rmSync(privatePath, { force: true });

            return inode;
        }
    }

    throw alreadyOwnedError(socketPath);
};

const releaseSocketPath = async (socketPath: string, inode: number): Promise<void> => {
    const lock = await acquireClaimLock(socketPath);

    try {
        removeEntry(socketPath, inode);
    } finally {
        await releaseClaimLock(lock);
    }
};

class SocketServer {
    private server: net.Server | null = null;
    private socketPath: string;
    private registry: ConnectionRegistry;
    private boundInode: number | null = null;
    private startup: Promise<void> | null = null;

    constructor(registry: ConnectionRegistry, socketPath: string = DEFAULT_SOCKET_PATH) {
        this.registry = registry;
        this.socketPath = socketPath;
    }

    private listen(privatePath: string): Promise<net.Server> {
        return new Promise((resolve, reject) => {
            const server = net.createServer((socket) => this.registry.register(socket));
            let isListening = false;

            server.on("error", (error) => {
                this.registry.dispatchEvent(connectionErrorEvent(error));

                if (!isListening) {
                    reject(error);
                }
            });

            server.listen(privatePath, () => {
                isListening = true;
                resolve(server);
            });
        });
    }

    private async listenPrivately(privatePath: string): Promise<net.Server> {
        try {
            return await this.listen(privatePath);
        } catch (error) {
            const failure = error as NodeJS.ErrnoException;
            throw listenFailureError(this.socketPath, failure.code ?? failure.message);
        }
    }

    private async bind(): Promise<void> {
        const privatePath = privatePathFor(this.socketPath);
        await clearStalePath(privatePath);
        const server = await this.listenPrivately(privatePath);

        try {
            this.boundInode = await publishSocket(privatePath, this.socketPath);
            this.server = server;
        } catch (error) {
            await closeServer(server);
            throw error;
        }
    }

    private open(): Promise<void> {
        return withClaimLock(this.socketPath, () => this.bind());
    }

    private async settleStartup(): Promise<void> {
        const startup = this.startup;
        this.startup = null;

        if (startup) {
            await Promise.allSettled([startup]);
        }
    }

    private async release(): Promise<void> {
        const inode = this.boundInode;
        this.boundInode = null;

        if (inode !== null) {
            await releaseSocketPath(this.socketPath, inode);
        }
    }

    async start(): Promise<void> {
        this.startup ??= this.open();
        const startup = this.startup;

        try {
            await startup;
        } catch (error) {
            if (this.startup === startup) {
                this.startup = null;
            }

            throw error;
        }
    }

    async stop(): Promise<void> {
        await this.settleStartup();
        const server = this.server;

        if (!server) {
            return;
        }

        this.server = null;
        this.registry.dispose();
        await closeServer(server);
        await this.release();
    }
}

export { SocketServer };
