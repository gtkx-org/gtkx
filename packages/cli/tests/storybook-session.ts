import type { SerializedWidget } from "@gtkx/mcp/internal";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ChildProcess } from "node:child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { mkdtempDisposableSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { cliEnvironment, type CliProject, startCli } from "./cli-project.js";

type StorybookSession = AsyncDisposable & {
    child: ChildProcess;
    output: () => string;
    call: (name: string, args?: Record<string, unknown>) => Promise<CallToolResult>;
    query: (by: string, value: string, options?: Record<string, unknown>) => Promise<SerializedWidget[]>;
    waitForWidget: (by: string, value: string, options?: Record<string, unknown>) => Promise<SerializedWidget>;
    waitForAbsent: (by: string, value: string) => Promise<void>;
    click: (by: string, value: string, options?: Record<string, unknown>) => Promise<void>;
    applicationPid: () => Promise<number>;
    stop: () => Promise<void>;
};

const TIMEOUT_MS = 60_000;
const POLL_MS = 100;
const SERVER_ENTRY = fileURLToPath(new URL("../../mcp/bin/gtkx-mcp.js", import.meta.url));

const delay = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, POLL_MS));

const contentText = (result: CallToolResult, output: string): string => {
    const entry = result.content.find((content) => content.type === "text");

    if (entry === undefined || result.isError === true) {
        throw new Error(`${entry?.text ?? "MCP returned no text"}\n${output}`);
    }

    return entry.text;
};

const stopChild = async (child: ChildProcess): Promise<void> => {
    if (child.exitCode !== null || child.signalCode !== null) {
        return;
    }

    await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
            child.kill("SIGKILL");
        }, 15_000);
        child.once("exit", () => {
            clearTimeout(timer);
            resolve();
        });
        child.kill("SIGTERM");
    });
};

const startStorybookSession = async (
    project: CliProject,
    args: string[] = [],
): Promise<StorybookSession> => {
    const temporary = mkdtempDisposableSync(join(tmpdir(), "gtkx-storybook-mcp-"));
    const inherited = Object.fromEntries(Object.entries(cliEnvironment()).filter(
        (entry): entry is [string, string] => entry[1] !== undefined,
    ));
    const environment = {
        ...inherited,
        GTKX_MCP_SOCKET_PATH: join(temporary.path, "mcp.sock"),
    };
    const client = new Client({ name: "gtkx-storybook-tests", version: "0.0.0" });
    const transport = new StdioClientTransport({
        command: process.execPath,
        args: [SERVER_ENTRY],
        cwd: project.root,
        env: environment,
        stderr: "ignore",
    });

    try {
        await client.connect(transport);
    } catch (error) {
        await client.close();
        temporary.remove();
        throw error;
    }

    const child = startCli(project, ["storybook", "--headless", "--size", "1000x800", ...args], environment);
    let output = "";
    child.stdout?.on("data", (chunk: Buffer) => {
        output += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer) => {
        output += chunk.toString();
    });

    const call = (name: string, values: Record<string, unknown> = {}): Promise<CallToolResult> =>
        client.callTool({ name, arguments: { appTimeout: TIMEOUT_MS, ...values } }) as Promise<CallToolResult>;

    const query = async (
        by: string,
        value: string,
        options?: Record<string, unknown>,
    ): Promise<SerializedWidget[]> => {
        const result = await call("gtkx_query_widgets", { by, value, ...(options !== undefined && { options }) });
        const parsed = JSON.parse(contentText(result, output)) as { widgets: SerializedWidget[] };

        return parsed.widgets;
    };

    const waitForWidget = async (
        by: string,
        value: string,
        options?: Record<string, unknown>,
    ): Promise<SerializedWidget> => {
        const deadline = Date.now() + TIMEOUT_MS;

        while (Date.now() < deadline) {
            const [widget] = await query(by, value, options);

            if (widget !== undefined) {
                return widget;
            }

            if (child.exitCode !== null || child.signalCode !== null) {
                break;
            }

            await delay();
        }

        throw new Error(`Storybook did not show ${by} ${value}: ${output}`);
    };

    let hasStopped = false;
    const stop = async (): Promise<void> => {
        if (hasStopped) {
            return;
        }

        hasStopped = true;
        await stopChild(child);
        await client.close();
        temporary.remove();
    };

    return {
        child,
        output: () => output,
        call,
        query,
        waitForWidget,
        waitForAbsent: async (by, value) => {
            const deadline = Date.now() + TIMEOUT_MS;

            while (Date.now() < deadline) {
                const widgets = await query(by, value);

                if (widgets.length === 0) {
                    return;
                }

                await delay();
            }

            throw new Error(`Storybook still shows ${by} ${value}: ${output}`);
        },
        click: async (by, value, options) => {
            const widget = await waitForWidget(by, value, options);
            const result = await call("gtkx_click", { widgetId: widget.id });

            if (result.isError === true) {
                throw new Error(contentText(result, output));
            }
        },
        applicationPid: async () => {
            const result = await call("gtkx_list_apps", { waitForApps: true, timeout: TIMEOUT_MS });
            const apps = JSON.parse(contentText(result, output)) as { pid: number }[];
            const app = apps[0];

            if (app === undefined) {
                throw new Error(`Storybook did not connect: ${output}`);
            }

            return app.pid;
        },
        stop,
        [Symbol.asyncDispose]: stop,
    };
};

export { startStorybookSession };
