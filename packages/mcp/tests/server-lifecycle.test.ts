import { once } from "node:events";
import { existsSync, rmSync } from "node:fs";
import { createConnection, type Socket } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { callJson, callTool, createProject, isToolFailure, type McpServer, startServer } from "./app-session.js";

type ServerState = { project: string; servers: McpServer[]; apps: Socket[] };
type FakeApp = { socket: Socket; hasFlooded: () => boolean; hasRegistered: () => boolean };

const SOCKET_TIMEOUT_MS = 10_000;
const SOCKET_POLL_MS = 50;
const LINK_TIMEOUT_MS = 10_000;
const FIN_SETTLE_MS = 200;
const FLOOD_BYTES = 4 * 1024 * 1024;
const PROBE_APP_ID = "org.gtkx.linkprobe";
const PROBE_WIDGET_ID = "probe-widget";
const state: ServerState = { project: "", servers: [], apps: [] };

const projectRoot = (): string => {
    state.project = state.project === "" ? createProject() : state.project;

    return state.project;
};

const trackedServer = async (): Promise<McpServer> => {
    const server = await startServer(projectRoot());
    state.servers.push(server);

    return server;
};

const serverOn = async (runtimeDir: string): Promise<McpServer> => {
    const server = await startServer(projectRoot(), runtimeDir);
    state.servers.push(server);

    return server;
};

const encode = (message: Record<string, unknown>): string => `${JSON.stringify(message)}\n`;

const connectFakeApp = async (socketPath: string): Promise<FakeApp> => {
    const socket = createConnection(socketPath);
    state.apps.push(socket);
    await once(socket, "connect");
    let hasFlooded = false;
    let hasRegistered = false;

    socket.on("data", (chunk: Buffer) => {
        const text = chunk.toString();

        if (text.includes("widget.type")) {
            socket.pause();
            hasFlooded = true;

            return;
        }

        hasRegistered ||= text.includes('"result"');
    });

    socket.write(
        encode({
            jsonrpc: "2.0",
            id: 1,
            method: "app.register",
            params: { applicationId: PROBE_APP_ID, pid: process.pid },
        }),
    );

    return { socket, hasFlooded: () => hasFlooded, hasRegistered: () => hasRegistered };
};

const waitUntil = async (isReady: () => boolean): Promise<void> => {
    const deadline = Date.now() + SOCKET_TIMEOUT_MS;

    while (!isReady() && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, SOCKET_POLL_MS));
    }
};

const waitForSocketRemoval = async (path: string): Promise<void> => {
    const deadline = Date.now() + SOCKET_TIMEOUT_MS;

    while (existsSync(path) && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, SOCKET_POLL_MS));
    }
};

afterEach(async () => {
    const servers = [...state.servers];
    state.servers.length = 0;

    for (const app of state.apps) {
        app.destroy();
    }

    state.apps.length = 0;
    await Promise.all(servers.map((server) => server.stop()));
    rmSync(state.project, { recursive: true, force: true });
    state.project = "";
});

describe("a running MCP server", () => {
    it("serves its tools with no application connected", async () => {
        const server = await trackedServer();
        const listed = await server.client.listTools();
        expect(listed.tools.map((tool) => tool.name)).toContain("gtkx_get_widget_tree");
        expect(await callJson(server.client, "gtkx_list_apps")).toEqual([]);
        expect(await isToolFailure(server.client, "gtkx_get_widget_tree", {})).toBe(true);
    });

    it("removes the socket it owns once it shuts down", async () => {
        const server = await trackedServer();
        expect(existsSync(server.socketPath)).toBe(true);
        await server.stop();
        await waitForSocketRemoval(server.socketPath);
        expect(existsSync(server.socketPath)).toBe(false);
    });
});

describe("a second MCP server on the same socket", () => {
    it("refuses to start while another server owns the socket", async () => {
        const owner = await trackedServer();
        await expect(serverOn(owner.runtimeDir)).rejects.toThrow();
    });

    it("takes the socket over once the server that owned it is gone", async () => {
        const owner = await trackedServer();
        process.kill(owner.pid ?? 0, "SIGKILL");
        expect(existsSync(owner.socketPath)).toBe(true);
        const successor = await serverOn(owner.runtimeDir);
        const listed = await successor.client.listTools();
        expect(listed.tools.map((tool) => tool.name)).toContain("gtkx_get_widget_tree");
    });
});

describe("an application whose link stops being writable", () => {
    it("fails the next request instead of waiting for the request timeout", async () => {
        const server = await trackedServer();
        const app = await connectFakeApp(server.socketPath);
        await waitUntil(app.hasRegistered);

        void callTool(server.client, "gtkx_type", {
            widgetId: PROBE_WIDGET_ID,
            text: "x".repeat(FLOOD_BYTES),
        }).catch(() => null);

        await waitUntil(app.hasFlooded);
        app.socket.end();
        await new Promise((resolve) => setTimeout(resolve, FIN_SETTLE_MS));
        expect(await isToolFailure(server.client, "gtkx_click", { widgetId: PROBE_WIDGET_ID })).toBe(true);
    }, LINK_TIMEOUT_MS);
});
