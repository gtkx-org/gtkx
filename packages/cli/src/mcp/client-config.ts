import { errorMessage } from "@gtkx/utils";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { indentOf } from "../internal/json-indent.js";

type ClientName = "claude" | "cursor" | "vscode" | "opencode" | "codex";
type ServerEntry = Record<string, unknown>;

type Client = {
    name: ClientName;
    file: string;
    key: string;
    entry: ServerEntry;
};

type ClientResult =
    | { kind: "written"; path: string; isCreated: boolean }
    | { kind: "manual"; path: string; snippet: string }
    | { kind: "unreadable"; path: string; key: string; snippet: string; reason: string };

const SERVER_NAME = "gtkx";
const JSON_INDENT = "    ";
const COMMAND = "npx";
const ARGS = ["--no", "gtkx", "mcp"];
const CODEX_PATH = join(".codex", "config.toml");
const SERVER_PATH = `mcp_servers.${SERVER_NAME}`;

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

const readOrUndefined = (path: string): string | undefined => {
    try {
        return readFileSync(path, "utf8");
    } catch (error) {
        if (error instanceof Error && (error as NodeJS.ErrnoException).code === "ENOENT") {
            return undefined;
        }

        throw error;
    }
};

const parseJson = (source: string): unknown => {
    try {
        return JSON.parse(source);
    } catch (error) {
        throw new Error(`it is not plain JSON, as when it has comments (${errorMessage(error)})`, { cause: error });
    }
};

const parseObject = (source: string): Record<string, unknown> => {
    const parsed = parseJson(source);

    if (!isRecord(parsed)) {
        throw new Error("its contents are not a JSON object");
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

const unquoteKey = (key: string): string =>
    key
        .split(".")
        .map((part) => part.trim().replace(/^(["'])(.*)\1$/, "$2"))
        .join(".");

const tableHeader = (line: string): { path: string; isArray: boolean } | undefined => {
    const match = /^\s*\[(\[?)([^\]]*)\]/.exec(line);

    return match === null ? undefined : { path: unquoteKey(match[2] ?? ""), isArray: match[1] === "[" };
};

const keyPath = (line: string): string | undefined => {
    const match = /^\s*([\w\-."' ]+?)\s*=/.exec(line);

    return match === null ? undefined : unquoteKey(match[1] ?? "");
};

const isSingleLineValue = (line: string): boolean => {
    const value = line.slice(line.indexOf("=") + 1);

    if (value.includes(`"""`) || value.includes(`'''`)) {
        return false;
    }

    let quote: string | undefined;
    let depth = 0;

    for (let index = 0; index < value.length; index++) {
        const char = value[index];

        if (quote !== undefined) {
            if (char === "\\" && quote === '"') {
                index++;
            } else if (char === quote) {
                quote = undefined;
            }
        } else if (char === '"' || char === "'") {
            quote = char;
        } else if (char === "#") {
            break;
        } else if (char === "[" || char === "{") {
            depth++;
        } else if (char === "]" || char === "}") {
            depth--;
        }
    }

    return quote === undefined && depth === 0;
};

const isBlankOrComment = (line: string): boolean => /^\s*(#.*)?$/.test(line);

const opensMultilineString = (line: string): string | undefined =>
    [`"""`, `'''`].find((delimiter) => line.split(delimiter).length % 2 === 0);

/**
 * Locates the `gtkx` server in the lines of a Codex TOML file without a TOML parser: `"absent"` when nothing
 * declares it, the line range of its `[mcp_servers.gtkx]` table when that table holds only single-line keys,
 * and `"unsafe"` for every other form (inline or dotted declarations, sub-tables, multi-line values) that a
 * line edit could break.
 */
const findCodexServer = (lines: string[]): "absent" | "unsafe" | { start: number; end: number } => {
    let table = "";
    let fence: string | undefined;
    let range: { start: number; end: number } | undefined;

    for (const [index, line] of lines.entries()) {
        if (fence !== undefined) {
            if (line.split(fence).length % 2 === 0) {
                fence = undefined;
            }

            continue;
        }

        const header = tableHeader(line);

        if (header !== undefined) {
            table = header.path;

            if (table === SERVER_PATH && !header.isArray && range === undefined) {
                range = { start: index, end: index };
            } else if (table === SERVER_PATH || table.startsWith(`${SERVER_PATH}.`)) {
                return "unsafe";
            }

            continue;
        }

        const key = keyPath(line);

        if (table === SERVER_PATH) {
            if (key === undefined ? !isBlankOrComment(line) : !isSingleLineValue(line)) {
                return "unsafe";
            }

            if (key !== undefined && range !== undefined) {
                range.end = index;
            }

            continue;
        }

        const path = key === undefined || table === "" ? key : `${table}.${key}`;

        if (path === "mcp_servers" || path === SERVER_PATH || path?.startsWith(`${SERVER_PATH}.`)) {
            return "unsafe";
        }

        fence = opensMultilineString(line);
    }

    return range ?? "absent";
};

const writeCodexConfig = (root: string): ClientResult => {
    const path = join(root, CODEX_PATH);
    const source = readOrUndefined(path);

    if (source === undefined) {
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, `${CODEX_SNIPPET}\n`);

        return { kind: "written", path, isCreated: true };
    }

    const lines = source.split(/\r?\n/);
    const server = findCodexServer(lines);

    if (server === "unsafe") {
        return { kind: "manual", path, snippet: CODEX_SNIPPET };
    }

    const newline = source.includes("\r\n") ? "\r\n" : "\n";
    const snippet = CODEX_SNIPPET.split("\n");

    if (server === "absent") {
        const body = source.trimEnd();
        lines.splice(0, lines.length, ...(body === "" ? [] : [body, ""]), ...snippet, "");
    } else {
        lines.splice(server.start, server.end - server.start + 1, ...snippet);
    }

    writeFileSync(path, lines.join(newline));

    return { kind: "written", path, isCreated: false };
};

const writeClientConfig = (root: string, name: ClientName): ClientResult => {
    if (name === "codex") {
        return writeCodexConfig(root);
    }

    const client = clientFor(name);

    const path = join(root, client.file);
    const source = readOrUndefined(path);
    let existing: Record<string, unknown> | undefined;

    try {
        existing = source === undefined ? undefined : parseObject(source);
    } catch (error) {
        const snippet = JSON.stringify({ [SERVER_NAME]: client.entry }, null, JSON_INDENT);

        return { kind: "unreadable", path, key: client.key, snippet, reason: errorMessage(error) };
    }

    const document = existing ?? {};
    const section = { ...getSection(document, client.key), [SERVER_NAME]: client.entry };
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(
        path,
        `${JSON.stringify({ ...document, [client.key]: section }, null, indentOf(source ?? "", JSON_INDENT))}\n`,
    );

    return { kind: "written", path, isCreated: existing === undefined };
};

export { CLIENTS, isClientName, writeClientConfig, type ClientName, type ClientResult };
