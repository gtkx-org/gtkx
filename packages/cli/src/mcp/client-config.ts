import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

type ClientName = "claude" | "cursor" | "vscode" | "opencode" | "codex";
type ServerEntry = Record<string, unknown>;

type Client = {
    name: ClientName;
    file: string;
    key: string;
    entry: ServerEntry;
};

type ClientResult =
    | { kind: "written"; path: string; isCreated: boolean } |
    { kind: "manual"; path: string; snippet: string };

const SERVER_NAME = "gtkx";
const COMMAND = "npx";
const ARGS = ["gtkx", "mcp"];
const CODEX_PATH = "~/.codex/config.toml";

const CODEX_SNIPPET = [
    `[mcp_servers.${SERVER_NAME}]`,
    `command = ${JSON.stringify(COMMAND)}`,
    `args = ${JSON.stringify(ARGS)}`,
].join("\n");

const CLIENTS: Client[] = [
    {
        name: "claude",
        file: ".mcp.json",
        key: "mcpServers",
        entry: { command: COMMAND, args: ARGS },
    },
    {
        name: "cursor",
        file: join(".cursor", "mcp.json"),
        key: "mcpServers",
        entry: { command: COMMAND, args: ARGS },
    },
    {
        name: "vscode",
        file: join(".vscode", "mcp.json"),
        key: "servers",
        entry: { type: "stdio", command: COMMAND, args: ARGS },
    },
    {
        name: "opencode",
        file: "opencode.json",
        key: "mcp",
        entry: { type: "local", command: [COMMAND, ...ARGS], enabled: true },
    },
    {
        name: "codex",
        file: CODEX_PATH,
        key: "mcp_servers",
        entry: {},
    },
];

const CLIENT_NAMES: Set<string> = new Set(CLIENTS.map((client) => client.name));

const isClientName = (value: string): value is ClientName => CLIENT_NAMES.has(value);

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const readJson = (path: string): Record<string, unknown> => {
    if (!existsSync(path)) {
        return {};
    }

    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));

    if (!isRecord(parsed)) {
        throw new Error(`Refusing to edit ${path}: its contents are not a JSON object.`);
    }

    return parsed;
};

const getSection = (document: Record<string, unknown>, key: string): Record<string, unknown> => {
    const section = document[key];

    return isRecord(section) ? section : {};
};

const clientFor = (name: ClientName): Client => {
    const client = CLIENTS.find((candidate) => candidate.name === name);

    if (client === undefined) {
        throw new Error(`Unknown MCP client "${name}".`);
    }

    return client;
};

const writeClientConfig = (root: string, name: ClientName): ClientResult => {
    const client = clientFor(name);

    if (name === "codex") {
        return { kind: "manual", path: CODEX_PATH, snippet: CODEX_SNIPPET };
    }

    const path = join(root, client.file);
    const isCreated = !existsSync(path);
    const document = readJson(path);
    const section = { ...getSection(document, client.key), [SERVER_NAME]: client.entry };
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify({ ...document, [client.key]: section }, null, 4)}\n`);

    return { kind: "written", path, isCreated };
};

export { CLIENTS, isClientName, writeClientConfig, type ClientName, type ClientResult };
