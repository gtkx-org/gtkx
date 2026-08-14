import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { type ChildProcess, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { SerializedProperty, SerializedWidget } from "../src/protocol/schemas.js";
import { APP_SOURCE } from "./app-source.js";

type McpServer = {
    client: Client;
    pid: number | null;
    runtimeDir: string;
    socketPath: string;
    stop: () => Promise<void>;
};

type AppSession = McpServer & { root: string };
type QueryResult = { widgets: SerializedWidget[] };
type WidgetProps = SerializedWidget & { properties?: Record<string, SerializedProperty> };
type QueryOptions = Record<string, unknown> | undefined;

const WORKSPACE_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const WORKSPACE_MODULES = join(WORKSPACE_ROOT, "node_modules");
const CLI_ENTRY = join(WORKSPACE_ROOT, "packages", "cli", "src", "cli.ts");
const SERVER_ENTRY = join(WORKSPACE_ROOT, "packages", "mcp", "src", "server.ts");
const TSX_ARGV = ["--conditions=source", "--import", "tsx"];
const SERVER_SCRIPT = `const { main } = await import(${JSON.stringify(SERVER_ENTRY)}); await main();`;
const SERVER_ARGV = [...TSX_ARGV, "--input-type=module", "-e", SERVER_SCRIPT];
const LINKED_PACKAGES = ["components", "config", "css", "native", "react", "runtime", "testing", "utils"];
const LINKED_MODULES = ["@types", "csstype", "react", "tsx"];
const STORE_NAMES = ["gi", "jsx"];
const SCOPE = "@gtkx";
const STORE_DIR = ".gtkx";
const SOCKET_NAME = "gtkx-mcp.sock";
const APPLICATION_ID = "org.gtkx.mcpprobe";
const LIBRARIES = ["Gtk-4.0", "Adw-1", "GtkSource-5", "WebKit-6.0"];
const MANIFEST = { name: "gtkx-mcp-probe", version: "1.0.0", type: "module" };
const APP_TIMEOUT_MS = 120_000;
const EXIT_TIMEOUT_MS = 15_000;
const ENTRY_MODULE = join("src", "index.tsx");

const configSource = (): string =>
    `export default { applicationId: ${JSON.stringify(APPLICATION_ID)}, libraries: ${JSON.stringify(LIBRARIES)} };\n`;

const linkInto = (nodeModules: string, name: string, target: string): void => {
    const link = join(nodeModules, name);
    mkdirSync(dirname(link), { recursive: true });
    symlinkSync(target, link, "dir");
};

const installModules = (nodeModules: string): void => {
    for (const name of LINKED_PACKAGES) {
        linkInto(nodeModules, join(SCOPE, name), join(WORKSPACE_ROOT, "packages", name));
    }

    for (const name of LINKED_MODULES) {
        linkInto(nodeModules, name, join(WORKSPACE_MODULES, name));
    }

    linkInto(nodeModules, STORE_DIR, join(WORKSPACE_MODULES, STORE_DIR));

    for (const name of STORE_NAMES) {
        symlinkSync(join("..", STORE_DIR, name), join(nodeModules, SCOPE, name), "dir");
    }
};

const createProject = (): string => {
    const root = mkdtempSync(join(tmpdir(), "gtkx-mcp-project-"));
    const nodeModules = join(root, "node_modules");
    mkdirSync(join(nodeModules, SCOPE), { recursive: true });
    installModules(nodeModules);
    writeFileSync(join(root, "package.json"), `${JSON.stringify(MANIFEST, null, 4)}\n`);
    writeFileSync(join(root, "gtkx.config.mjs"), configSource());
    mkdirSync(join(root, "src"));
    writeFileSync(join(root, ENTRY_MODULE), APP_SOURCE);

    return root;
};

const inheritedEnvironment = (): Record<string, string> => {
    const entries = Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined);

    return Object.fromEntries(entries);
};

const childEnvironment = (runtimeDir: string): Record<string, string> => {
    const display = process.env.WAYLAND_DISPLAY ?? "wayland-0";
    const parent = process.env.XDG_RUNTIME_DIR ?? tmpdir();

    return {
        ...inheritedEnvironment(),
        ...(process.env.GTKX_COVERAGE_DIR !== undefined && { NODE_V8_COVERAGE: process.env.GTKX_COVERAGE_DIR }),
        GTKX_DISABLE_PREFLIGHT: "1",
        XDG_RUNTIME_DIR: runtimeDir,
        WAYLAND_DISPLAY: display.startsWith("/") ? display : join(parent, display),
    };
};

const waitForExit = (child: ChildProcess): Promise<void> =>
    new Promise((resolve) => {
        const timer = setTimeout(resolve, EXIT_TIMEOUT_MS);

        child.once("exit", () => {
            clearTimeout(timer);
            resolve();
        });
    });

const stopApp = async (child: ChildProcess): Promise<void> => {
    child.kill("SIGTERM");
    await waitForExit(child);
};

const startServer = async (cwd: string, existingRuntimeDir?: string): Promise<McpServer> => {
    const runtimeDir = existingRuntimeDir ?? mkdtempSync(join(tmpdir(), "gtkx-mcp-runtime-"));

    const transport = new StdioClientTransport({
        command: process.execPath,
        args: SERVER_ARGV,
        cwd,
        env: childEnvironment(runtimeDir),
        stderr: "ignore",
    });

    const client = new Client({ name: "gtkx-mcp-tests", version: "0.0.0" });
    await client.connect(transport);

    return {
        client,
        pid: transport.pid,
        runtimeDir,
        socketPath: join(runtimeDir, SOCKET_NAME),
        stop: async () => {
            await client.close();

            if (existingRuntimeDir === undefined) {
                rmSync(runtimeDir, { recursive: true, force: true });
            }
        },
    };
};

const startApp = (root: string, runtimeDir: string): ChildProcess =>
    spawn(process.execPath, [...TSX_ARGV, CLI_ENTRY, "dev"], {
        cwd: root,
        env: childEnvironment(runtimeDir),
        stdio: ["ignore", "ignore", "ignore"],
    });

const startAppSession = async (): Promise<AppSession> => {
    const root = createProject();
    const server = await startServer(root);
    const app = startApp(root, server.runtimeDir);

    await server.client.callTool({
        name: "gtkx_list_apps",
        arguments: { waitForApps: true, timeout: APP_TIMEOUT_MS },
    });

    return {
        ...server,
        root,
        stop: async () => {
            await stopApp(app);
            await server.stop();
            rmSync(root, { recursive: true, force: true });
        },
    };
};

const callTool = (client: Client, name: string, args: Record<string, unknown> = {}): Promise<CallToolResult> =>
    client.callTool({ name, arguments: args }) as Promise<CallToolResult>;

const contentText = (result: CallToolResult): string => {
    const [entry] = result.content;

    if (entry?.type !== "text") {
        throw new TypeError(`Expected text content in ${JSON.stringify(result)}`);
    }

    return entry.text;
};

const callText = async (client: Client, name: string, args: Record<string, unknown> = {}): Promise<string> => {
    const result = await callTool(client, name, args);

    if (result.isError === true) {
        throw new Error(contentText(result));
    }

    return contentText(result);
};

const callJson = async <T>(client: Client, name: string, args: Record<string, unknown> = {}): Promise<T> =>
    JSON.parse(await callText(client, name, args)) as T;

const queryWidgets = (client: Client, by: string, value: string, options?: QueryOptions): Promise<QueryResult> =>
    callJson<QueryResult>(client, "gtkx_query_widgets", { by, value, ...(options !== undefined && { options }) });

const findWidget = async (
    client: Client,
    by: string,
    value: string,
    options?: QueryOptions,
): Promise<SerializedWidget> => {
    const result = await queryWidgets(client, by, value, options);
    const [match] = result.widgets;

    if (match === undefined) {
        throw new Error(`Expected a match for ${by} "${value}"`);
    }

    return match;
};

const readWidgetProps = (
    client: Client,
    widgetId: string,
    options: Record<string, unknown> = {},
): Promise<WidgetProps> => callJson<WidgetProps>(client, "gtkx_get_widget_props", { widgetId, ...options });

const isToolFailure = async (client: Client, name: string, args: Record<string, unknown>): Promise<boolean> => {
    const result = await callTool(client, name, args);

    return result.isError === true;
};

export {
    APPLICATION_ID,
    type AppSession,
    callJson,
    callText,
    callTool,
    createProject,
    findWidget,
    isToolFailure,
    type McpServer,
    type QueryResult,
    queryWidgets,
    readWidgetProps,
    startAppSession,
    startServer,
    type WidgetProps,
};
