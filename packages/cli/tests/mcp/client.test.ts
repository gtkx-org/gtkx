import { mkdtempSync, rmSync } from "node:fs";
import * as net from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => {
    class FakeApplication {}
    return {
        listToplevels: vi.fn(() => [] as unknown[]),
        getDefault: vi.fn(() => null as unknown),
        FakeApplication,
    };
});

vi.mock("@gtkx/gi/gtk", () => ({
    AccessibleRole: {} as Record<string, number>,
    Window: { listToplevels: hoisted.listToplevels },
    Application: hoisted.FakeApplication,
}));

vi.mock("@gtkx/gi/gio", () => ({
    Application: { getDefault: hoisted.getDefault },
}));

import { McpClient } from "../../src/mcp/client.js";

type ServerContext = {
    server: net.Server;
    socketPath: string;
    sockets: net.Socket[];
    received: string[][];
};

const startServer = (): ServerContext => {
    const dir = mkdtempSync(join(tmpdir(), "mcp-client-test-"));
    const socketPath = join(dir, "sock");
    const sockets: net.Socket[] = [];
    const received: string[][] = [];
    const server = net.createServer((socket) => {
        const lines: string[] = [];
        received.push(lines);
        sockets.push(socket);
        let buffer = "";
        socket.on("data", (data: Buffer) => {
            buffer += data.toString();
            let idx = buffer.indexOf("\n");
            while (idx !== -1) {
                const line = buffer.slice(0, idx);
                buffer = buffer.slice(idx + 1);
                if (line.trim()) lines.push(line);
                idx = buffer.indexOf("\n");
            }
        });
    });
    server.listen(socketPath);
    return { server, socketPath, sockets, received };
};

const closeServer = (ctx: ServerContext): Promise<void> =>
    new Promise((resolve) => {
        for (const socket of ctx.sockets) {
            socket.destroy();
        }
        ctx.server.close(() => {
            rmSync(ctx.socketPath, { force: true });
            resolve();
        });
    });

const waitFor = async (predicate: () => boolean, timeoutMs = 1000): Promise<void> => {
    const start = Date.now();
    while (!predicate()) {
        if (Date.now() - start > timeoutMs) {
            throw new Error("waitFor timed out");
        }
        await new Promise((r) => setTimeout(r, 10));
    }
};

const parseLines = (lines: string[]): Record<string, unknown>[] =>
    lines.map((line) => JSON.parse(line) as Record<string, unknown>);

type PendingRegistration = {
    client: McpClient;
    connectPromise: Promise<void>;
    registerLine: Record<string, unknown> | undefined;
};

const beginRegistration = async (ctx: ServerContext): Promise<PendingRegistration> => {
    const client = new McpClient({ socketPath: ctx.socketPath, applicationId: "com.test.app" });
    const connectPromise = client.connect();
    await waitFor(() => ctx.received[0]?.length === 1);
    const [registerLine] = parseLines(ctx.received[0] ?? []);
    return { client, connectPromise, registerLine };
};

const connectAndRegister = async (ctx: ServerContext): Promise<McpClient> => {
    const { client, connectPromise, registerLine } = await beginRegistration(ctx);
    ctx.sockets[0]?.write(`${JSON.stringify({ id: registerLine?.["id"], result: {} })}\n`);
    await connectPromise;
    return client;
};

let ctx: ServerContext;

beforeEach(() => {
    vi.clearAllMocks();
    ctx = startServer();
});

afterEach(async () => {
    await closeServer(ctx);
});

describe("McpClient.connect", () => {
    it("connects and sends an app.register request as its first message", async () => {
        const { client, connectPromise, registerLine } = await beginRegistration(ctx);

        expect(registerLine?.["method"]).toBe("app.register");
        expect((registerLine?.["params"] as { applicationId: string }).applicationId).toBe("com.test.app");

        ctx.sockets[0]?.write(`${JSON.stringify({ id: registerLine?.["id"], result: {} })}\n`);
        await connectPromise;

        client.disconnect();
    });
});

describe("McpClient response correlation", () => {
    it("ignores responses whose ids do not match any pending request", async () => {
        const { client, connectPromise, registerLine } = await beginRegistration(ctx);

        ctx.sockets[0]?.write(`${JSON.stringify({ id: "unknown-id", result: { stale: true } })}\n`);
        ctx.sockets[0]?.write(`${JSON.stringify({ id: registerLine?.["id"], result: {} })}\n`);

        await expect(connectPromise).resolves.toBeUndefined();

        client.disconnect();
    });
});

describe("McpClient incoming requests", () => {
    it("responds to inbound requests with a method-not-found error when the application is not initialized", async () => {
        hoisted.getDefault.mockReturnValue(null);
        const client = await connectAndRegister(ctx);

        ctx.sockets[0]?.write(
            `${JSON.stringify({ id: "req-1", method: "widget.click", params: { widgetId: "x" } })}\n`,
        );

        await waitFor(() => ctx.received[0]?.length === 2);
        const [, responseLine] = parseLines(ctx.received[0] ?? []);
        expect(responseLine?.["id"]).toBe("req-1");
        expect((responseLine?.["error"] as { message: string }).message).toMatch(/not initialized/);

        client.disconnect();
    });

    it("ignores malformed JSON without crashing the socket", async () => {
        const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
        const client = await connectAndRegister(ctx);

        ctx.sockets[0]?.write("not json\n");
        await new Promise((r) => setTimeout(r, 20));

        const written = stderrSpy.mock.calls.map((call) => String(call[0])).join("");
        expect(written).toContain("invalid JSON");

        stderrSpy.mockRestore();
        client.disconnect();
    });

    it("dispatches an inbound request and returns its result when the app is initialized", async () => {
        hoisted.getDefault.mockReturnValue(new hoisted.FakeApplication());
        const client = await connectAndRegister(ctx);

        ctx.sockets[0]?.write(`${JSON.stringify({ id: "req-ok", method: "app.getWindows" })}\n`);

        await waitFor(() => ctx.received[0]?.length === 2);
        const [, responseLine] = parseLines(ctx.received[0] ?? []);
        expect(responseLine?.["id"]).toBe("req-ok");
        expect((responseLine?.["result"] as { windows: unknown[] }).windows).toEqual([]);

        client.disconnect();
    });

    it("returns a structured error code when dispatch throws an McpError", async () => {
        hoisted.getDefault.mockReturnValue(new hoisted.FakeApplication());
        const client = await connectAndRegister(ctx);

        ctx.sockets[0]?.write(`${JSON.stringify({ id: "req-bad", method: "does.not.exist" })}\n`);

        await waitFor(() => ctx.received[0]?.length === 2);
        const [, responseLine] = parseLines(ctx.received[0] ?? []);
        expect(responseLine?.["id"]).toBe("req-bad");
        expect(typeof (responseLine?.["error"] as { code: number }).code).toBe("number");
        expect((responseLine?.["error"] as { message: string }).message).toMatch(/does\.not\.exist/);

        client.disconnect();
    });
});

describe("McpClient.disconnect", () => {
    it("sends app.unregister before closing the socket", async () => {
        const client = await connectAndRegister(ctx);

        client.disconnect();
        await waitFor(() => ctx.received[0]?.length === 2);

        const [, unregisterLine] = parseLines(ctx.received[0] ?? []);
        expect(unregisterLine?.["method"]).toBe("app.unregister");
    });

    it("rejects an in-flight connect() promise when disconnect is called first", async () => {
        const client = new McpClient({ socketPath: ctx.socketPath, applicationId: "com.test.app" });

        const connectPromise = client.connect();
        client.disconnect();

        await expect(connectPromise).rejects.toThrow(/disconnected before connection registered/);
    });
});

describe("McpClient connection failures", () => {
    it("rejects connect() and cancels the reconnect timer when the socket is unavailable", async () => {
        const client = new McpClient({
            socketPath: join(tmpdir(), "mcp-client-missing", "sock"),
            applicationId: "com.test.app",
        });

        await expect(client.connect()).rejects.toThrow();

        client.disconnect();
    });

    it("rejects connect() when the server refuses registration", async () => {
        const { client, connectPromise, registerLine } = await beginRegistration(ctx);

        ctx.sockets[0]?.write(
            `${JSON.stringify({ id: registerLine?.["id"], error: { code: -1, message: "refused" } })}\n`,
        );

        await expect(connectPromise).rejects.toThrow();

        client.disconnect();
    });

    it("schedules a reconnect when the server drops an established connection", async () => {
        const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
        const client = await connectAndRegister(ctx);

        ctx.sockets[0]?.destroy();
        await waitFor(() => stderrSpy.mock.calls.some((call) => String(call[0]).includes("Disconnected")));

        stderrSpy.mockRestore();
        client.disconnect();
    });
});
