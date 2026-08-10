import type { ChildProcess } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
    abandonSocket,
    connectClient,
    delay,
    inodeFor,
    raceMcpServers,
    saturateOwnerBacklog,
    setupSocketServer,
    socketCtx,
    spawnLockHolder,
    spawnMcpServer,
    startTracked,
    waitForExit,
} from "./socket-server-harness.js";

type ShutdownRoute = "sigterm" | "sigint" | "stdin-end" | "stdin-close" | "exception";

const CHILD_TIMEOUT_MS = 30_000;
const RACE_TIMEOUT_MS = 60_000;
const BLOCKED_LISTENER_MS = 20_000;
const CONTENDER_COUNT = 4;
const CLAIM_WAIT_MS = 300;
const REFUSED_ROUTES: ShutdownRoute[] = ["sigterm", "sigint", "stdin-end", "stdin-close", "exception"];

const ROUTE_SIGNALS: Partial<Record<ShutdownRoute, NodeJS.Signals>> = {
    sigterm: "SIGTERM",
    sigint: "SIGINT",
};

const triggerRoute = (child: ChildProcess, route: ShutdownRoute): void => {
    const signal = ROUTE_SIGNALS[route];

    if (signal) {
        child.kill(signal);

        return;
    }

    if (route !== "exception") {
        child.stdin?.end();
    }
};

const shutDownRefusedServer = async (route: ShutdownRoute, expected: RegExp): Promise<number | null> => {
    const inode = inodeFor(socketCtx.socketPath);
    const { banner, child } = await spawnMcpServer(socketCtx.socketPath, route);
    expect(banner).toMatch(expected);
    triggerRoute(child, route);
    await waitForExit(child);

    return inode;
};

describe("gtkx-mcp shutdown routes against a reachable owner", () => {
    setupSocketServer();

    it.each(REFUSED_ROUTES)(
        "leaves the owner's socket alone when a server that failed to bind shuts down via %s",
        async (route) => {
            await socketCtx.server.start();
            const inode = await shutDownRefusedServer(route, /REFUSED .*already owns/);
            expect(inodeFor(socketCtx.socketPath)).toBe(inode);
            const client = await connectClient(socketCtx.socketPath);
            expect(client.readyState).toBe("open");
            client.destroy();
        },
        CHILD_TIMEOUT_MS,
    );
});

describe("gtkx-mcp shutdown routes against an owner the probe cannot reach", () => {
    setupSocketServer();

    it.each(REFUSED_ROUTES)(
        "leaves a live server's socket alone when a probe failure precedes shutdown via %s",
        async (route) => {
            await saturateOwnerBacklog(socketCtx.socketPath, BLOCKED_LISTENER_MS);
            const inode = await shutDownRefusedServer(route, /REFUSED .*Could not tell whether/);
            expect(inode).not.toBeNull();
            expect(inodeFor(socketCtx.socketPath)).toBe(inode);
        },
        CHILD_TIMEOUT_MS,
    );
});

describe("gtkx-mcp socket cleanup", () => {
    setupSocketServer();

    it(
        "removes the socket it bound itself when shutting down",
        async () => {
            const { banner, child } = await spawnMcpServer(socketCtx.socketPath, "sigterm");
            expect(banner).toContain("STARTED");
            expect(inodeFor(socketCtx.socketPath)).not.toBeNull();
            const client = await connectClient(socketCtx.socketPath);
            client.destroy();
            child.kill("SIGTERM");
            await waitForExit(child);
            expect(inodeFor(socketCtx.socketPath)).toBeNull();
        },
        CHILD_TIMEOUT_MS,
    );

    it(
        "starts once the socket left behind by a killed server is cleaned up",
        async () => {
            const first = await spawnMcpServer(socketCtx.socketPath, "sigterm");
            expect(first.banner).toContain("STARTED");
            first.child.kill("SIGKILL");
            await waitForExit(first.child);
            expect(inodeFor(socketCtx.socketPath)).not.toBeNull();
            const second = await spawnMcpServer(socketCtx.socketPath, "sigterm");
            expect(second.banner).toContain("STARTED");
            const client = await connectClient(socketCtx.socketPath);
            expect(client.readyState).toBe("open");
            client.destroy();
            second.child.kill("SIGTERM");
            await waitForExit(second.child);
        },
        CHILD_TIMEOUT_MS,
    );
});

describe("gtkx-mcp claims across processes", () => {
    setupSocketServer();

    it(
        "gives one process the path when several race over a socket a killed server left",
        async () => {
            await abandonSocket(socketCtx.socketPath);
            const banners = await raceMcpServers(socketCtx.socketPath, CONTENDER_COUNT);
            expect(banners.filter((banner) => banner.includes("STARTED"))).toHaveLength(1);
            expect(banners.filter((banner) => banner.includes("already owns"))).toHaveLength(CONTENDER_COUNT - 1);
            const client = await connectClient(socketCtx.socketPath);
            expect(client.readyState).toBe("open");
            client.destroy();
        },
        RACE_TIMEOUT_MS,
    );

    it(
        "waits for a claim another process holds and takes the path once that process is killed",
        async () => {
            const holder = await spawnLockHolder(socketCtx.socketPath);
            const tracker = startTracked(socketCtx.server);
            await delay(CLAIM_WAIT_MS);
            expect(tracker.isStarted).toBe(false);
            holder.kill("SIGKILL");
            await waitForExit(holder);
            await tracker.promise;
            const client = await connectClient(socketCtx.socketPath);
            expect(client.readyState).toBe("open");
            client.destroy();
        },
        CHILD_TIMEOUT_MS,
    );
});
