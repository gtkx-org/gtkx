import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { once } from "node:events";
import { existsSync, mkdtempDisposableSync, writeFileSync } from "node:fs";
import { createConnection } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ProtocolConnection } from "../src/internal.js";
import { createMcpServer, type CreateMcpServerOptions } from "../src/server.js";

const openServer = async (options: Partial<CreateMcpServerOptions> = {}) => {
    const directory = mkdtempDisposableSync(join(tmpdir(), "gtkx-mcp-test-"));
    const socketPath = join(directory.path, "app.sock");
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createMcpServer({
        version: "0.0.0",
        socketPath,
        cwd: directory.path,
        ...options,
        transport: serverTransport,
    });
    const client = new Client({ name: "integration", version: "1.0.0" });
    try {
        await server.start();
        await client.connect(clientTransport);
    } catch (error) {
        await server.stop();
        directory[Symbol.dispose]();
        throw error;
    }
    return {
        client,
        server,
        socketPath,
        root: directory.path,
        async [Symbol.asyncDispose]() {
            await client.close();
            await server.stop();
            directory[Symbol.dispose]();
        },
    };
};

const textResult = async (client: Client, name: string, args: Record<string, unknown> = {}) => {
    const result = CallToolResultSchema.parse(await client.callTool({ name, arguments: args }));
    expect(result.isError).not.toBe(true);
    return result.content
        .filter((content) => content.type === "text")
        .map((content) => content.text)
        .join("\n");
};

describe("MCP server", () => {
    it("negotiates tools and removes its socket after an idempotent stop", async () => {
        await using session = await openServer();
        expect((await session.client.listTools()).tools.map((tool) => tool.name)).toEqual(
            expect.arrayContaining(["gtkx_list_apps", "gtkx_get_widget_tree", "gtkx_click", "gtkx_get_api_docs"]),
        );
        expect(JSON.parse(await textResult(session.client, "gtkx_list_apps"))).toEqual([]);
        expect(existsSync(session.socketPath)).toBe(true);
        await session.server.stop();
        await session.server.stop();
        expect(existsSync(session.socketPath)).toBe(false);
        await expect(session.server.start()).rejects.toThrow("stopped");
    });

    it("registers an application over a real socket and routes requests through the SDK", async () => {
        await using session = await openServer();
        const socket = createConnection(session.socketPath);
        await once(socket, "connect");
        const connection = ProtocolConnection.fromSocket(socket, {
            onClose: () => undefined,
            onError: () => undefined,
        });
        connection.fallbackRequestHandler = (request) => {
            if (request.method === "app.getWindows")
                return Promise.resolve({ windows: [{ id: "window", title: "Example" }] });
            if (request.method === "widget.getTree") return Promise.resolve({ tree: "Application > Button" });
            return Promise.resolve({ clicked: request.params?.widgetId });
        };
        try {
            await connection.send("app.register", { applicationId: "org.gtkx.test", pid: process.pid });
            expect(JSON.parse(await textResult(session.client, "gtkx_list_apps"))).toEqual([
                expect.objectContaining({
                    applicationId: "org.gtkx.test",
                    windows: [{ id: "window", title: "Example" }],
                }),
            ]);
            expect(await textResult(session.client, "gtkx_get_widget_tree")).toBe("Application > Button");
            expect(await textResult(session.client, "gtkx_click", { widgetId: "button" })).toBe("Clicked");
            await connection.send("app.unregister");
            expect(JSON.parse(await textResult(session.client, "gtkx_list_apps"))).toEqual([]);
        } finally {
            await connection.close();
        }
    });

    it("enforces tool selection and reports requests without an application", async () => {
        await using session = await openServer({
            settings: { tools: ["gtkx_*", "!gtkx_take_screenshot"], isReadOnly: true },
        });
        const names = (await session.client.listTools()).tools.map((tool) => tool.name);
        expect(names).toContain("gtkx_get_widget_tree");
        expect(names).not.toContain("gtkx_click");
        expect(names).not.toContain("gtkx_take_screenshot");
        expect(
            await session.client.callTool({ name: "gtkx_get_widget_tree", arguments: { appTimeout: 0 } }),
        ).toMatchObject({ isError: true });
    });

    it("serves upstream API reference tools and resources from project configuration", async () => {
        await using session = await openServer();
        writeFileSync(
            join(session.root, "gtkx.config.mjs"),
            'export default { applicationId: "org.gtkx.reference", libraries: ["Gio-2.0"] };',
        );
        const docs = await textResult(session.client, "gtkx_get_api_docs", { symbol: "Gio.File", kind: "interface" });
        expect(docs).toContain("Gio");
        expect(docs).toContain("File");
        expect((await session.client.listResourceTemplates()).resourceTemplates.length).toBeGreaterThan(0);
    });

    it("refuses to replace an active socket or an unrelated file", async () => {
        await using session = await openServer();
        const contender = createMcpServer({ version: "0.0.0", socketPath: session.socketPath });
        await expect(contender.start()).rejects.toThrow();
        await contender.stop();
        const path = join(session.root, "keep.txt");
        writeFileSync(path, "keep");
        const invalid = createMcpServer({ version: "0.0.0", socketPath: path });
        await expect(invalid.start()).rejects.toThrow();
        await invalid.stop();
        expect(existsSync(path)).toBe(true);
    });
});
