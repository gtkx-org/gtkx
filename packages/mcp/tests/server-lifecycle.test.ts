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
const OVERSIZED_MESSAGE_BYTES = 80 * 1024 * 1024;
const OVERSIZED_CHUNK = Buffer.alloc(1024 * 1024, 0x61);
const OVERSIZED_TIMEOUT_MS = 60_000;
const STALLED_WRITE_BYTES = 16 * 1024 * 1024;
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
    let received = "";

    socket.on("data", (chunk: Buffer) => {
        received += chunk.toString();

        if (received.includes("widget.type")) {
            socket.pause();
            hasFlooded = true;

            return;
        }

        hasRegistered ||= received.includes('"result"');
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

const typeIntoStalledApp = (server: McpServer): void => {
    void callTool(server.client, "gtkx_type", {
        widgetId: PROBE_WIDGET_ID,
        text: "x".repeat(FLOOD_BYTES),
    }).catch(() => null);
};

const linkClosed = (socket: Socket): Promise<void> =>
    new Promise((resolve) => {
        socket.once("close", () => {
            resolve();
        });
    });

const linkDrained = (socket: Socket): Promise<void> =>
    new Promise((resolve) => {
        const settle = (): void => {
            socket.off("drain", settle);
            socket.off("close", settle);
            resolve();
        };

        socket.once("drain", settle);
        socket.once("close", settle);
    });

const sendOversizedMessage = async (socket: Socket): Promise<void> => {
    let written = 0;

    while (written < OVERSIZED_MESSAGE_BYTES && socket.writable) {
        written += OVERSIZED_CHUNK.length;

        if (!socket.write(OVERSIZED_CHUNK)) {
            await linkDrained(socket);
        }
    }
};

const connectRawApp = async (socketPath: string): Promise<Socket> => {
    const socket = createConnection(socketPath);
    state.apps.push(socket);
    await once(socket, "connect");

    socket.on("error", () => {
        socket.destroy();
    });

    return socket;
};

const waitUntil = async (isReady: () => boolean): Promise<void> => {
    const deadline = Date.now() + SOCKET_TIMEOUT_MS;

    while (!isReady() && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, SOCKET_POLL_MS));
    }
};

const waitForAppCount = async (server: McpServer, count: number): Promise<void> => {
    const deadline = Date.now() + SOCKET_TIMEOUT_MS;

    while (Date.now() < deadline) {
        const apps = await callJson<unknown[]>(server.client, "gtkx_list_apps");

        if (apps.length === count) {
            return;
        }

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

describe("an application that sends a message with no end to it", () => {
    it("loses its connection while the server keeps serving", async () => {
        const server = await trackedServer();
        const socket = await connectRawApp(server.socketPath);
        void sendOversizedMessage(socket);
        await linkClosed(socket);
        expect(await callJson(server.client, "gtkx_list_apps")).toEqual([]);
    }, OVERSIZED_TIMEOUT_MS);
});

describe("an application that stops reading what the server sends", () => {
    it("loses its connection while the server keeps serving", async () => {
        const server = await trackedServer();
        const app = await connectFakeApp(server.socketPath);
        await waitUntil(app.hasRegistered);
        typeIntoStalledApp(server);
        await waitUntil(app.hasFlooded);

        for (let queued = 0; queued < STALLED_WRITE_BYTES; queued += FLOOD_BYTES) {
            typeIntoStalledApp(server);
        }

        await waitForAppCount(server, 0);
        expect(await callJson(server.client, "gtkx_list_apps")).toEqual([]);
    }, LINK_TIMEOUT_MS);
});

describe("an application that sends a message the server cannot parse", () => {
    it("keeps its connection and acts on the next message", async () => {
        const server = await trackedServer();
        const app = await connectFakeApp(server.socketPath);
        await waitUntil(app.hasRegistered);
        app.socket.write("this line is not json\n");
        app.socket.write(encode({ jsonrpc: "2.0", id: 2, method: "app.unregister" }));
        await waitForAppCount(server, 0);
        expect(await callJson<unknown[]>(server.client, "gtkx_list_apps")).toHaveLength(0);
    }, LINK_TIMEOUT_MS);
});
