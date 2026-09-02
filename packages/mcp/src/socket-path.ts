import { createHash } from "node:crypto";
import { lstatSync, mkdirSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

type McpSocketAddress = {
    path: string;
    fallbackDirectory: string | null;
};

const MCP_SOCKET_PATH_ENV = "GTKX_MCP_SOCKET_PATH";
const SOCKET_NAME = "gtkx-mcp.sock";
const SOCKET_PATH_BYTE_LIMIT = 100;
const SHORT_SOCKET_ROOT = "/tmp";

const socketCandidate = (): string =>
    process.env[MCP_SOCKET_PATH_ENV] ?? join(process.env.XDG_RUNTIME_DIR ?? tmpdir(), SOCKET_NAME);

const currentUserId = (): number => {
    const getuid = process.getuid;

    if (getuid === undefined) {
        throw new Error("GTKX MCP Unix sockets require a platform with user IDs");
    }

    return getuid();
};

const verifyPrivateDirectory = (directory: string, userId: number): void => {
    const entry = lstatSync(directory);

    if (!entry.isDirectory() || entry.uid !== userId || (entry.mode & 0o777) !== 0o700) {
        throw new Error(`GTKX MCP fallback socket directory is not private: ${directory}`);
    }
};

const ensurePrivateDirectory = (directory: string, userId: number): void => {
    try {
        mkdirSync(directory, { mode: 0o700 });
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
            throw error;
        }
    }

    verifyPrivateDirectory(directory, userId);
};

const fallbackAddress = (candidate: string): McpSocketAddress => {
    const userId = currentUserId();
    const digest = createHash("sha256").update(candidate).digest("hex").slice(0, 24);
    const fallbackDirectory = join(SHORT_SOCKET_ROOT, `gtkx-mcp-${String(userId)}-${digest}`);

    try {
        verifyPrivateDirectory(fallbackDirectory, userId);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
            throw error;
        }
    }

    return { path: join(fallbackDirectory, "socket"), fallbackDirectory };
};

const resolveMcpSocketAddress = (providedPath?: string): McpSocketAddress => {
    const candidate = providedPath ?? socketCandidate();

    return Buffer.byteLength(candidate) <= SOCKET_PATH_BYTE_LIMIT
        ? { path: candidate, fallbackDirectory: null }
        : fallbackAddress(candidate);
};

const resolveMcpSocketPath = (providedPath?: string): string => resolveMcpSocketAddress(providedPath).path;

const prepareMcpSocketAddress = (address: McpSocketAddress): void => {
    if (address.fallbackDirectory !== null) {
        ensurePrivateDirectory(address.fallbackDirectory, currentUserId());
    }
};

const cleanupMcpSocketAddress = (address: McpSocketAddress): void => {
    const directory = address.fallbackDirectory;

    if (directory === null) {
        return;
    }

    try {
        verifyPrivateDirectory(directory, currentUserId());
        rmdirSync(directory);
    } catch {
        return;
    }
};

export {
    cleanupMcpSocketAddress,
    MCP_SOCKET_PATH_ENV,
    prepareMcpSocketAddress,
    resolveMcpSocketAddress,
    resolveMcpSocketPath,
    type McpSocketAddress,
};
