import { errorMessage, indentOf } from "@gtkx/utils";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { isClassicYarn, type Workspace } from "./build-allowance.js";
import type { PackageManager } from "./package-managers.js";

type McpServer = { command: string; args: string[] };

type McpConfig = { config: Record<string, unknown>; indent: string };

type WorkspaceMcpResult =
    | { kind: "added"; path: string; key: string }
    | { kind: "present"; path: string; key: string }
    | { kind: "shared"; path: string; key: string }
    | { kind: "unreadable"; path: string; key: string; server: McpServer; reason: string };

const MCP_CONFIG_FILE = ".mcp.json";
const SERVERS_KEY = "mcpServers";
const SERVER_NAME = "gtkx";
const SERVER_COMMAND = ["gtkx", "mcp"];
const JSON_INDENT = "    ";

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

const readConfig = (path: string): McpConfig => {
    let source: string;

    try {
        source = readFileSync(path, "utf8");
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            return { config: {}, indent: JSON_INDENT };
        }

        throw error;
    }

    const config: unknown = JSON.parse(source);

    if (!isRecord(config) || (Object.hasOwn(config, SERVERS_KEY) && !isRecord(config[SERVERS_KEY]))) {
        throw new Error(`its contents are not an object with an object "${SERVERS_KEY}"`);
    }

    return { config, indent: indentOf(source, JSON_INDENT) };
};

const isGtkxServer = (key: string, server: unknown): boolean => {
    if (key === SERVER_NAME) {
        return true;
    }

    const args = isRecord(server) && Array.isArray(server.args) ? server.args : [];

    return isDeepStrictEqual(args.slice(-SERVER_COMMAND.length), SERVER_COMMAND);
};

/**
 * Adds a server that starts the app's own `gtkx mcp` through the workspace's package manager to the
 * workspace root's `.mcp.json`, where AI clients opened at the repository root look for it. Other servers and
 * the file's indentation stay. When the file already has a GTKX server, such as an earlier app's, no second one
 * is added: the GTKX servers of a session share one socket, and that server drives every running app.
 */
const addWorkspaceMcpServer = (workspace: Workspace, name: string): WorkspaceMcpResult => {
    const path = join(workspace.root, MCP_CONFIG_FILE);
    const server = WORKSPACE_SERVERS[workspace.packageManager](workspace, name);
    let document: McpConfig;

    try {
        document = readConfig(path);
    } catch (error) {
        return { kind: "unreadable", path, key: SERVER_NAME, server, reason: errorMessage(error) };
    }

    const { config, indent } = document;

    const servers = isRecord(config[SERVERS_KEY]) ? config[SERVERS_KEY] : {};
    const keys = Object.keys(servers);
    const present = keys.find((key) => isDeepStrictEqual(servers[key], server));

    if (present !== undefined) {
        return { kind: "present", path, key: present };
    }

    const shared = keys.find((key) => isGtkxServer(key, servers[key]));

    if (shared !== undefined) {
        return { kind: "shared", path, key: shared };
    }

    writeFileSync(
        path,
        `${JSON.stringify({ ...config, [SERVERS_KEY]: { ...servers, [SERVER_NAME]: server } }, null, indent)}\n`,
    );

    return { kind: "added", path, key: SERVER_NAME };
};

export { addWorkspaceMcpServer };
