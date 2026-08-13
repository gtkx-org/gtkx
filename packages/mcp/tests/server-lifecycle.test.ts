import { existsSync, rmSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { callJson, createProject, isToolFailure, type McpServer, startServer } from "./app-session.js";

type ServerState = { project: string; servers: McpServer[] };

const SOCKET_TIMEOUT_MS = 10_000;
const SOCKET_POLL_MS = 50;
const state: ServerState = { project: "", servers: [] };

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

const waitForSocketRemoval = async (path: string): Promise<void> => {
    const deadline = Date.now() + SOCKET_TIMEOUT_MS;

    while (existsSync(path) && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, SOCKET_POLL_MS));
    }
};

afterEach(async () => {
    const servers = [...state.servers];
    state.servers.length = 0;
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
