import { type ChildProcess, spawn } from "node:child_process";
import { once } from "node:events";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import * as net from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, onTestFinished } from "vitest";
import type { Request } from "../src/protocol/schemas.js";
import type { ConnectionRequestEvent, ProtocolConnection } from "../src/transport.js";
import { ConnectionRegistry } from "../src/connection-registry.js";
import { SocketServer } from "../src/socket-server.js";

type SocketServerContext = {
    tmpDir: string;
    socketPath: string;
    server: SocketServer;
    registry: ConnectionRegistry;
};

type StartTracker = {
    isStarted: boolean;
    promise: Promise<void>;
};

const socketCtx = {} as SocketServerContext;

const BLOCKED_LISTENER_SCRIPT = String.raw`
    const net = require("node:net");
    const server = net.createServer(() => undefined);

    server.listen({ path: process.argv[1], backlog: 1 }, () => {
        process.stdout.write("ready\n");
        const end = Date.now() + Number(process.argv[2]);

        while (Date.now() < end) {
            process.exitCode = 0;
        }
    });
`;

const ABANDONED_LISTENER_SCRIPT = String.raw`
    const net = require("node:net");
    const server = net.createServer(() => undefined);

    server.listen(process.argv[1], () => {
        process.stdout.write("ready\n");
    });
`;

const LOCK_HOLDER_SCRIPT = String.raw`
    const { writeSync } = await import("node:fs");
    const { withClaimLock } = await import("./src/socket-server.ts");

    await withClaimLock(process.argv[1], async () => {
        writeSync(1, "ready\n");

        await new Promise(() => undefined);
    });
`;

const MCP_SERVER_SCRIPT = String.raw`
    const { writeSync } = await import("node:fs");
    const { installGracefulShutdown } = await import("@gtkx/utils");
    const { createMcpServer } = await import("./src/server.ts");

    const route = process.argv[2];
    const server = createMcpServer({ socketPath: process.argv[1], version: "0.0.0-test" });
    const keepAlive = setInterval(() => undefined, 1 << 30);

    const shutdown = async () => {
        await server.stop();
        clearInterval(keepAlive);
    };

    installGracefulShutdown({ onSignal: shutdown });

    if (route === "stdin-end" || route === "stdin-close") {
        process.stdin.resume();
        process.stdin.on(route === "stdin-end" ? "end" : "close", () => void shutdown());
    }

    try {
        await server.start();
        writeSync(1, "STARTED\n");
    } catch (error) {
        writeSync(1, "REFUSED " + error.message.replace(/\s+/g, " ") + "\n");

        if (route === "exception") {
            clearInterval(keepAlive);
            throw error;
        }
    }
`;

const BACKLOG_SATURATION_TIMEOUT_MS = 2000;
const CONNECT_RETRY_INTERVAL_MS = 25;
const UNIX_SOCKET_TABLE = "/proc/net/unix";
const UNIX_SOCKET_PATH_FIELD = 7;
const UNIX_SOCKET_FIELDS = 8;
const UNIX_SOCKET_TABLE_ROWS = 100_000;
const MCP_PACKAGE_DIR = join(import.meta.dirname, "..");
const MCP_SERVER_BANNER = /STARTED|REFUSED/;
const TSX_ARGV = ["--conditions=source", "--import", "tsx", "--input-type=module", "-e"];
const MCP_SERVER_ARGV = [...TSX_ARGV, MCP_SERVER_SCRIPT];
const LOCK_HOLDER_ARGV = [...TSX_ARGV, LOCK_HOLDER_SCRIPT];

const delay = (ms: number): Promise<void> =>
    new Promise((resolve) => {
        setTimeout(resolve, ms);
    });

const connectClient = (path: string): Promise<net.Socket> =>
    new Promise((resolve, reject) => {
        const socket = net.createConnection(path);

        socket.once("connect", () => {
            resolve(socket);
        });

        socket.once("error", reject);
    });

const tryConnect = (path: string): Promise<Error | null> =>
    new Promise((resolve) => {
        const socket = net.createConnection(path);

        socket.once("connect", () => {
            socket.destroy();
            resolve(null);
        });

        socket.once("error", (error) => {
            resolve(error);
        });
    });

const listeningPathIn = (directory: string): string | null => {
    const rows = readFileSync(UNIX_SOCKET_TABLE, "utf8").split("\n", UNIX_SOCKET_TABLE_ROWS);
    const paths = rows.map((row) => row.split(/\s+/, UNIX_SOCKET_FIELDS)[UNIX_SOCKET_PATH_FIELD]);

    return paths.find((path) => path?.startsWith(directory)) ?? null;
};

const padSocketPath = (tmpDir: string, name: string, length: number): string => {
    const padding = length - join(tmpDir, name).length - 1;
    const directory = join(tmpDir, "d".repeat(padding));
    mkdirSync(directory, { recursive: true });

    return join(directory, name);
};

const connectWhenReady = async (path: string, timeoutMs: number): Promise<net.Socket> => {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        if ((await tryConnect(path)) === null) {
            return connectClient(path);
        }

        await new Promise((resolve) => setTimeout(resolve, CONNECT_RETRY_INTERVAL_MS));
    }

    throw new Error(`nothing accepted a connection on ${path}`);
};

const inodeFor = (path: string): number | null => {
    try {
        return statSync(path).ino;
    } catch {
        return null;
    }
};

const markStarted = async (server: SocketServer, tracker: StartTracker): Promise<void> => {
    await server.start();
    tracker.isStarted = true;
};

const startTracked = (server: SocketServer): StartTracker => {
    const tracker: StartTracker = { isStarted: false, promise: Promise.resolve() };
    tracker.promise = markStarted(server, tracker);

    return tracker;
};

const waitForMarker = (child: ChildProcess, marker: RegExp): Promise<string> =>
    new Promise((resolve) => {
        let output = "";

        child.stdout?.on("data", (data: Buffer) => {
            output += data.toString();

            if (marker.test(output)) {
                resolve(output);
            }
        });
    });

const waitForExit = (child: ChildProcess): Promise<number | null> =>
    new Promise((resolve) => {
        child.once("exit", (code) => {
            resolve(code);
        });
    });

const spawnListener = async (script: string, args: string[]): Promise<ChildProcess> => {
    const child = spawn(process.execPath, ["-e", script, ...args], { stdio: ["ignore", "pipe", "pipe"] });
    await waitForMarker(child, /ready/);

    return child;
};

const spawnTsxChild = (argv: string[], args: string[]): ChildProcess => {
    const child = spawn(process.execPath, [...argv, ...args], {
        cwd: MCP_PACKAGE_DIR,
        stdio: ["pipe", "pipe", "pipe"],
    });

    onTestFinished(() => {
        child.kill("SIGKILL");
    });

    return child;
};

const spawnMcpServer = async (path: string, route: string): Promise<{ banner: string; child: ChildProcess }> => {
    const child = spawnTsxChild(MCP_SERVER_ARGV, [path, route]);

    return { banner: await waitForMarker(child, MCP_SERVER_BANNER), child };
};

const raceMcpServers = async (path: string, count: number): Promise<string[]> => {
    const spawned = Array.from({ length: count }, () => spawnMcpServer(path, "sigterm"));
    const settled = await Promise.all(spawned);

    return settled.map((result) => result.banner);
};

const spawnLockHolder = async (path: string): Promise<ChildProcess> => {
    const child = spawnTsxChild(LOCK_HOLDER_ARGV, [path]);
    await waitForMarker(child, /ready/);

    return child;
};

const startBlockedListener = async (path: string, blockMs: number): Promise<void> => {
    const child = await spawnListener(BLOCKED_LISTENER_SCRIPT, [path, String(blockMs)]);

    onTestFinished(() => {
        child.kill("SIGKILL");
    });
};

const abandonSocket = async (path: string): Promise<void> => {
    const child = await spawnListener(ABANDONED_LISTENER_SCRIPT, [path]);
    child.kill("SIGKILL");
    await once(child, "exit");
};

const saturateBacklog = async (path: string): Promise<void> => {
    const sockets: net.Socket[] = [];

    onTestFinished(() => {
        for (const socket of sockets) {
            socket.destroy();
        }
    });

    const deadline = Date.now() + BACKLOG_SATURATION_TIMEOUT_MS;

    while (Date.now() < deadline) {
        const error: NodeJS.ErrnoException | null = await tryConnect(path);

        if (error?.code === "EAGAIN") {
            return;
        }

        const pending = net.connect(path);

        pending.on("error", () => {
            pending.destroy();
        });

        sockets.push(pending);
    }

    throw new Error("the listen backlog never saturated");
};

const saturateOwnerBacklog = async (path: string, blockMs: number): Promise<void> => {
    await startBlockedListener(path, blockMs);
    await saturateBacklog(path);
};

const collectLines = (socket: net.Socket): { lines: string[]; promise: Promise<void> } => {
    let buffer = "";
    const lines: string[] = [];

    const promise: Promise<void> = new Promise((resolve) => {
        socket.on("data", (data: Buffer) => {
            buffer += data.toString();
            let idx = buffer.indexOf("\n");

            while (idx !== -1) {
                lines.push(buffer.slice(0, idx));
                buffer = buffer.slice(idx + 1);
                idx = buffer.indexOf("\n");
            }
        });

        socket.on("close", () => {
            resolve();
        });
    });

    return { lines, promise };
};

const waitForConnection = (registry: ConnectionRegistry): Promise<ProtocolConnection> =>
    new Promise((resolve) => {
        const original = registry.register.bind(registry);

        registry.register = (socket) => {
            const connection = original(socket);
            registry.register = original;
            resolve(connection);

            return connection;
        };
    });

function setupSocketServer(): void {
    beforeEach(() => {
        socketCtx.tmpDir = mkdtempSync(join(tmpdir(), "gtkx-socket-server-"));
        socketCtx.socketPath = join(socketCtx.tmpDir, "gtkx-mcp.sock");
        socketCtx.registry = new ConnectionRegistry();
        socketCtx.server = new SocketServer(socketCtx.registry, socketCtx.socketPath);
    });

    afterEach(async () => {
        await socketCtx.server.stop();
        rmSync(socketCtx.tmpDir, { recursive: true, force: true });
    });
}

const startWithClient = async (): Promise<net.Socket> => {
    await socketCtx.server.start();

    return connectClient(socketCtx.socketPath);
};

const startWithConnection = async (): Promise<{ client: net.Socket; connection: ProtocolConnection }> => {
    await socketCtx.server.start();
    const connectionPromise = waitForConnection(socketCtx.registry);
    const client = await connectClient(socketCtx.socketPath);

    return { client, connection: await connectionPromise };
};

const nextRequest = (registry: ConnectionRegistry): Promise<Request> =>
    new Promise((resolve) => {
        registry.addEventListener(
            "request",
            (event) => {
                resolve((event as ConnectionRequestEvent).detail.request);
            },
            { once: true },
        );
    });

const collectFirstFrame = async <T>(client: net.Socket, act: () => void): Promise<T> => {
    const collector = collectLines(client);
    act();
    const deadline = Date.now() + 2000;

    while (collector.lines.length === 0 && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 5));
    }

    client.destroy();
    await collector.promise;
    expect(collector.lines.length).toBeGreaterThan(0);

    return JSON.parse(collector.lines[0] as string) as T;
};

export {
    abandonSocket,
    collectFirstFrame,
    connectClient,
    connectWhenReady,
    delay,
    inodeFor,
    listeningPathIn,
    nextRequest,
    padSocketPath,
    raceMcpServers,
    saturateOwnerBacklog,
    setupSocketServer,
    socketCtx,
    spawnLockHolder,
    spawnMcpServer,
    startTracked,
    startWithClient,
    startWithConnection,
    tryConnect,
    waitForExit,
};
