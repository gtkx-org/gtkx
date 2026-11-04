import { errorMessage } from "@gtkx/utils";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { isClassicYarn, type Workspace } from "./build-allowance.js";
import type { PackageManager } from "./package-managers.js";

type McpServer = { command: string; args: string[] };

type WorkspaceMcpResult =
    | { kind: "added"; path: string; key: string }
    | { kind: "present"; path: string; key: string }
    | { kind: "unreadable"; path: string; key: string; server: McpServer; reason: string };

const MCP_CONFIG_FILE = ".mcp.json";
const SERVERS_KEY = "mcpServers";
const SERVER_NAME = "gtkx";
const SERVER_COMMAND = ["gtkx", "mcp"];

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const yarnServer = (workspace: Workspace, name: string): McpServer =>
    isClassicYarn(workspace.root)
        ? { command: "yarn", args: ["--silent", "--cwd", workspace.member, ...SERVER_COMMAND] }
        : { command: "yarn", args: ["workspace", name, "exec", ...SERVER_COMMAND] };

const WORKSPACE_SERVERS: Record<PackageManager, (workspace: Workspace, name: string) => McpServer> = {
    pnpm: ({ member }) => ({ command: "pnpm", args: ["--dir", member, "exec", ...SERVER_COMMAND] }),
    npm: ({ member }) => ({ command: "npm", args: ["exec", "--no", "--workspace", member, "--", ...SERVER_COMMAND] }),
    yarn: yarnServer,
};

const readConfig = (path: string): Record<string, unknown> => {
    let source: string;

    try {
        source = readFileSync(path, "utf8");
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            return {};
        }

        throw error;
    }

    const config: unknown = JSON.parse(source);

    if (!isRecord(config) || (Object.hasOwn(config, SERVERS_KEY) && !isRecord(config[SERVERS_KEY]))) {
        throw new Error(`its contents are not an object with an object "${SERVERS_KEY}"`);
    }

    return config;
};

const serverKey = (servers: Record<string, unknown>, server: McpServer, name: string): string => {
    const existing = Object.keys(servers).find((key) => isDeepStrictEqual(servers[key], server));

    if (existing !== undefined) {
        return existing;
    }

    return Object.hasOwn(servers, SERVER_NAME)
        ? `${SERVER_NAME}-${name.replace(/^@/, "").replace(/[^\w-]+/g, "-")}`
        : SERVER_NAME;
};

/**
 * Adds a server that starts the app's own `gtkx mcp` through the workspace's package manager to the
 * workspace root's `.mcp.json`, where AI clients opened at the repository root look for it. Other servers
 * stay; the entry is named `gtkx`, or `gtkx-<name>` when another app's server already has that name.
 */
const addWorkspaceMcpServer = (workspace: Workspace, name: string): WorkspaceMcpResult => {
    const path = join(workspace.root, MCP_CONFIG_FILE);
    const server = WORKSPACE_SERVERS[workspace.packageManager](workspace, name);
    let config: Record<string, unknown>;

    try {
        config = readConfig(path);
    } catch (error) {
        return { kind: "unreadable", path, key: SERVER_NAME, server, reason: errorMessage(error) };
    }

    const servers = isRecord(config[SERVERS_KEY]) ? config[SERVERS_KEY] : {};
    const key = serverKey(servers, server, name);

    if (isDeepStrictEqual(servers[key], server)) {
        return { kind: "present", path, key };
    }

    writeFileSync(path, `${JSON.stringify({ ...config, [SERVERS_KEY]: { ...servers, [key]: server } }, null, 4)}\n`);

    return { kind: "added", path, key };
};

export { addWorkspaceMcpServer };
