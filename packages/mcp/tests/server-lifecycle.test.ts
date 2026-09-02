import { LATEST_PROTOCOL_VERSION } from "@modelcontextprotocol/sdk/types.js";
import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { once } from "node:events";
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    statSync,
    watch,
    writeFileSync,
} from "node:fs";
import { createConnection, type Socket } from "node:net";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
    callJson,
    callText,
    callTool,
    createProject,
    isToolFailure,
    type McpServer,
    startServer,
} from "./app-session.js";

type ServerState = {
    project: string;
    servers: McpServer[];
    apps: Socket[];
    runtimeRoots: string[];
    rawServers: ChildProcessWithoutNullStreams[];
};
type FakeApp = { socket: Socket; hasFlooded: () => boolean; hasRegistered: () => boolean };

const SOCKET_TIMEOUT_MS = 10_000;
const SHUTDOWN_TIMEOUT_MS = 3000;
const SOCKET_POLL_MS = 50;
const LINK_TIMEOUT_MS = 10_000;
const FIN_SETTLE_MS = 200;
const FLOOD_BYTES = 4 * 1024 * 1024;
const OVERSIZED_MESSAGE_BYTES = 80 * 1024 * 1024;
const OVERSIZED_CHUNK = Buffer.alloc(1024 * 1024, 0x61);
const OVERSIZED_TIMEOUT_MS = 60_000;
const STALLED_WRITE_BYTES = 16 * 1024 * 1024;
const PROBE_APP_ID = "org.gtkx.linkprobe";
const DELAYED_APP_ID = "org.gtkx.delayed";
const PROBE_WIDGET_ID = "probe-widget";
const SERVER_ENTRY = fileURLToPath(new URL("../src/server.ts", import.meta.url));
const SERVER_SCRIPT = `const { main } = await import(${JSON.stringify(SERVER_ENTRY)}); await main();`;
const SERVER_ARGUMENTS = ["--conditions=source", "--import=tsx", "--input-type=module", "-e", SERVER_SCRIPT];
const state: ServerState = { project: "", servers: [], apps: [], runtimeRoots: [], rawServers: [] };

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

const longRuntimeDirectory = (): string => {
    const runtimeRoot = mkdtempSync(join(tmpdir(), "gtkx-mcp-long-"));
    const runtimeDir = join(runtimeRoot, "nested".repeat(24));
    state.runtimeRoots.push(runtimeRoot);
    mkdirSync(runtimeDir);

    return runtimeDir;
};

const startRawServer = (runtimeDir: string): ChildProcessWithoutNullStreams => {
    const child = spawn(process.execPath, SERVER_ARGUMENTS, {
        cwd: projectRoot(),
        env: { ...process.env, GTKX_DISABLE_PREFLIGHT: "1", XDG_RUNTIME_DIR: runtimeDir },
        stdio: "pipe",
    });

    state.rawServers.push(child);

    return child;
};

const sendRawMessage = (child: ChildProcessWithoutNullStreams, message: Record<string, unknown>): void => {
    child.stdin.write(`${JSON.stringify(message)}\n`);
};

const initializeRawServer = async (child: ChildProcessWithoutNullStreams): Promise<void> => {
    const lines = createInterface({ input: child.stdout });
    const response = once(lines, "line");
    sendRawMessage(child, {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
            protocolVersion: LATEST_PROTOCOL_VERSION,
            capabilities: {},
            clientInfo: { name: "gtkx-lifecycle-probe", version: "1.0.0" },
        },
    });
    await response;
    lines.close();
    sendRawMessage(child, { jsonrpc: "2.0", method: "notifications/initialized" });
};

const waitForRawServerExit = (
    child: ChildProcessWithoutNullStreams,
    timeout: number = SHUTDOWN_TIMEOUT_MS,
): Promise<number | null> => {
    if (child.exitCode !== null || child.signalCode !== null) {
        return Promise.resolve(child.exitCode);
    }

    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            child.off("exit", onExit);
            reject(new Error("Timed out waiting for raw MCP server exit"));
        }, timeout);
        const onExit = (code: number | null): void => {
            clearTimeout(timeoutId);
            resolve(code);
        };

        child.once("exit", onExit);
    });
};

const stopRawServers = async (): Promise<void> => {
    for (const child of state.rawServers) {
        if (child.exitCode !== null || child.signalCode !== null) {
            continue;
        }

        child.kill("SIGKILL");
        await waitForRawServerExit(child);
    }

    state.rawServers.length = 0;
};

const encode = (message: Record<string, unknown>): string => `${JSON.stringify(message)}\n`;

const connectFakeApp = async (socketPath: string, applicationId: string = PROBE_APP_ID): Promise<FakeApp> => {
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
            params: { applicationId, pid: process.pid },
        }),
    );

    return { socket, hasFlooded: () => hasFlooded, hasRegistered: () => hasRegistered };
};

const connectTreeApp = async (socketPath: string, applicationId: string): Promise<Socket> => {
    const socket = createConnection(socketPath);
    state.apps.push(socket);
    await once(socket, "connect");
    let buffered = "";

    socket.on("data", (chunk: Buffer) => {
        buffered += chunk.toString();
        const messages = buffered.split("\n");
        buffered = messages.pop() ?? "";

        for (const encoded of messages) {
            const message = JSON.parse(encoded) as { id?: number; method?: string };

            if (message.method === "widget.getTree" && message.id !== undefined) {
                socket.write(encode({ jsonrpc: "2.0", id: message.id, result: { tree: applicationId } }));
            }
        }
    });

    socket.write(
        encode({
            jsonrpc: "2.0",
            id: 1,
            method: "app.register",
            params: { applicationId, pid: process.pid },
        }),
    );

    return socket;
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
    await stopRawServers();

    for (const app of state.apps) {
        app.destroy();
    }

    state.apps.length = 0;
    await Promise.all(servers.map((server) => server.stop()));

    for (const runtimeRoot of state.runtimeRoots) {
        rmSync(runtimeRoot, { recursive: true, force: true });
    }

    state.runtimeRoots.length = 0;
    rmSync(state.project, { recursive: true, force: true });
    state.project = "";
});

describe("a running MCP server", () => {
    it("serves its tools with no application connected", async () => {
        const server = await trackedServer();
        const listed = await server.client.listTools();
        expect(listed.tools.map((tool) => tool.name)).toContain("gtkx_get_widget_tree");
        expect(await callJson(server.client, "gtkx_list_apps")).toEqual([]);
        expect(await isToolFailure(server.client, "gtkx_get_widget_tree", { appTimeout: 0 })).toBe(true);
    });

    it("waits for the requested application instead of using an earlier registration", async () => {
        const server = await trackedServer();
        const result = callText(server.client, "gtkx_get_widget_tree", {
            applicationId: DELAYED_APP_ID,
            appTimeout: SOCKET_TIMEOUT_MS,
        });

        const earlier = await connectFakeApp(server.socketPath, PROBE_APP_ID);
        await waitUntil(earlier.hasRegistered);
        await connectTreeApp(server.socketPath, DELAYED_APP_ID);
        expect(await result).toBe(DELAYED_APP_ID);
    });

    it("removes the socket it owns once it shuts down", async () => {
        const server = await trackedServer();
        expect(existsSync(server.socketPath)).toBe(true);
        await server.stop();
        await waitForSocketRemoval(server.socketPath);
        expect(existsSync(server.socketPath)).toBe(false);
    });
});

describe("an MCP server under a long runtime path", () => {
    it("uses a deterministic private socket that applications can reach", async () => {
        const runtimeDir = longRuntimeDirectory();
        const server = await serverOn(runtimeDir);
        expect(server.socketPath).not.toBe(join(runtimeDir, "gtkx-mcp.sock"));
        expect(statSync(dirname(server.socketPath)).mode & 0o777).toBe(0o700);
        await connectTreeApp(server.socketPath, PROBE_APP_ID);
        expect(await callText(server.client, "gtkx_get_widget_tree", { applicationId: PROBE_APP_ID })).toBe(
            PROBE_APP_ID,
        );
    });

    it("rejects a second start while the fallback is owned", async () => {
        const runtimeDir = longRuntimeDirectory();
        await serverOn(runtimeDir);
        await expect(serverOn(runtimeDir)).rejects.toThrow();
    });

    it("hands the fallback socket over during a rapid shutdown", async () => {
        const runtimeDir = longRuntimeDirectory();
        const owner = await serverOn(runtimeDir);
        const fallbackDirectory = dirname(owner.socketPath);
        const stopping = owner.stop();
        const successor = await serverOn(runtimeDir);
        await stopping;
        await connectTreeApp(successor.socketPath, PROBE_APP_ID);
        expect(await callText(successor.client, "gtkx_get_widget_tree", { applicationId: PROBE_APP_ID })).toBe(
            PROBE_APP_ID,
        );
        await successor.stop();
        await waitForSocketRemoval(fallbackDirectory);
        expect(existsSync(fallbackDirectory)).toBe(false);
    });
});

describe("MCP server shutdown", () => {
    it("finishes a shutdown requested while the socket is starting", async () => {
        const runtimeDir = longRuntimeDirectory();
        const probe = await serverOn(runtimeDir);
        const fallbackDirectory = dirname(probe.socketPath);
        const fallbackName = basename(fallbackDirectory);
        await probe.stop();
        const signalSent = Promise.withResolvers<undefined>();
        let child: ChildProcessWithoutNullStreams | undefined;
        const watcher = watch(dirname(fallbackDirectory), (_event, filename) => {
            if (child === undefined || filename?.toString() !== fallbackName) {
                return;
            }

            child.kill("SIGTERM");
            signalSent.resolve(undefined);
        });
        watcher.on("error", (error) => {
            signalSent.reject(error);
        });
        const timeoutId = setTimeout(() => {
            signalSent.reject(new Error("Timed out waiting for fallback socket startup"));
        }, SOCKET_TIMEOUT_MS);

        try {
            child = startRawServer(runtimeDir);
            await signalSent.promise;
            expect(await waitForRawServerExit(child)).toBe(0);
            expect(existsSync(fallbackDirectory)).toBe(false);
        } finally {
            clearTimeout(timeoutId);
            watcher.close();
        }
    });

    it("cancels an app wait when its client disconnects", async () => {
        const runtimeDir = mkdtempSync(join(tmpdir(), "gtkx-mcp-runtime-"));
        state.runtimeRoots.push(runtimeDir);
        const socketPath = join(runtimeDir, "gtkx-mcp.sock");
        const child = startRawServer(runtimeDir);
        await initializeRawServer(child);
        sendRawMessage(child, {
            jsonrpc: "2.0",
            id: 2,
            method: "tools/call",
            params: { name: "gtkx_list_apps", arguments: { waitForApps: true, timeout: 60_000 } },
        });
        await new Promise((resolve) => setTimeout(resolve, SOCKET_POLL_MS));
        child.stdin.end();
        expect(await waitForRawServerExit(child)).toBe(0);
        expect(existsSync(socketPath)).toBe(false);
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

    it("refuses to remove a non-socket entry", async () => {
        const runtimeDir = mkdtempSync(join(tmpdir(), "gtkx-mcp-runtime-"));
        const socketPath = join(runtimeDir, "gtkx-mcp.sock");
        state.runtimeRoots.push(runtimeDir);
        writeFileSync(socketPath, "preserve me");

        await expect(serverOn(runtimeDir)).rejects.toThrow();
        expect(readFileSync(socketPath, "utf8")).toBe("preserve me");
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
