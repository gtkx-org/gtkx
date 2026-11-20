import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { createMcpServer } from "@gtkx/mcp/server";
import { runCommand } from "citty";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { stdout, stderr } from "test-console";
import { expect, vi } from "vitest";
import { createCommand } from "../dist/command.js";
import { createProject, linkWorkspaceBindings } from "./project.js";

const invoke = async (args: string[], selected = createCommand()) => {
    let output = "";
    let errors = "";
    await stderr.inspectAsync(async (chunks) => {
        await stdout.inspectAsync(async (messages) => {
            await runCommand(selected, { rawArgs: args });
            output = messages.join("");
        });
        errors = chunks.join("");
    });
    return output + errors;
};

const withSession = async (
    name: string,
    root: string,
    readyPath: string,
    verify: () => Promise<void>,
    args: string[] = [],
    applicationArgs: string[] = [],
) => {
    const controller = new AbortController();
    const running = invoke(
        [name, "--cwd", root, "--headless", "--size", "640x480", ...args],
        createCommand({ signal: controller.signal, applicationArgs }),
    );
    let output: string;
    try {
        await Promise.race([
            expect.poll(() => existsSync(readyPath), { timeout: 60_000 }).toBe(true),
            running.then(() => {
                throw new Error("Session ended before loading the application");
            }),
        ]);
        await verify();
    } finally {
        controller.abort();
        output = await running;
    }

    return output;
};

const withMcpClient = async (root: string, run: (client: Client) => Promise<void>) => {
    const socketPath = join(root, "mcp.sock");
    vi.stubEnv("GTKX_MCP_SOCKET_PATH", socketPath);
    const [clientTransport, transport] = InMemoryTransport.createLinkedPair();
    const server = createMcpServer({ transport, socketPath, version: "1.0.0", cwd: root });
    const client = new Client({ name: "cli-test", version: "1.0.0" });
    try {
        await server.start();
        await client.connect(clientTransport);
        await run(client);
    } finally {
        await client.close();
        await server.stop();
    }
};

const callTool = async (client: Client, name: string, args: Record<string, unknown> = {}) => {
    const result = CallToolResultSchema.parse(await client.callTool({ name, arguments: args }));
    const text = result.content.map((content) => (content.type === "text" ? content.text : "")).join("\n");
    return { isError: result.isError === true, text };
};

const writeWidgetApp = (project: ReturnType<typeof createProject>, readyPath: string, content: string) => {
    linkWorkspaceBindings(project.root);
    project.write("src/content.tsx", content);
    project.write(
        "src/index.tsx",
        `import { AdwApplication, AdwApplicationWindow } from "@gtkx/jsx/adw";
        import { createRoot } from "@gtkx/react";
        import { writeFileSync } from "node:fs";
        import { useEffect } from "react";
        import { Content } from "./content.tsx";
        const Ready = () => {
            useEffect(() => writeFileSync(${JSON.stringify(readyPath)}, "ready"), []);
            return null;
        };
        createRoot().render(
            <AdwApplication applicationId="org.gtkx.example">
                <AdwApplicationWindow><Ready /><Content /></AdwApplicationWindow>
            </AdwApplication>
        );`,
    );
};

const queryWidgets = async (client: Client, query: Record<string, unknown>) => {
    const { text } = await callTool(client, "gtkx_query_widgets", query);
    return (JSON.parse(text) as { widgets: { id: string; type: string; name: string | null }[] }).widgets;
};

export { callTool, invoke, queryWidgets, withMcpClient, withSession, writeWidgetApp };
