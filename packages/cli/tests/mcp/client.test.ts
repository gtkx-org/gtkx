import { mkdtempSync, rmSync } from "node:fs";
import * as net from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";
import { McpClient } from "../../src/mcp/client.js";

type ServerContext = {
    server: net.Server;
    socketPath: string;
    sockets: net.Socket[];
    received: string[][];
};

type ServerFixture = {
    ctx: ServerContext;
};

type PendingRegistration = {
    client: McpClient;
    connectPromise: Promise<void>;
    registerLine: Record<string, unknown> | undefined;
};

const hoisted = vi.hoisted(() => {
    class FakeApplication {
        applicationId = "com.test.app";
    }

    return {
        listToplevels: vi.fn(() => [] as unknown[]),
        getDefault: vi.fn((): unknown => null),
        FakeApplication,
    };
});

const fixture = setupServerFixture();

const drainLines = (buffer: string, lines: string[]): string => {
    let remaining = buffer;
    let idx = remaining.indexOf("\n");

    while (idx !== -1) {
        const line = remaining.slice(0, idx);
        remaining = remaining.slice(idx + 1);

        if (line.trim()) {
            lines.push(line);
        }

        idx = remaining.indexOf("\n");
    }

    return remaining;
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
            buffer = drainLines(buffer + data.toString(), lines);
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

function setupServerFixture(): ServerFixture {
    const created = {} as ServerFixture;

    beforeEach(() => {
        vi.clearAllMocks();
        created.ctx = startServer();
    });

    afterEach(async () => {
        await closeServer(created.ctx);
    });

    return created;
}

const waitFor = async (isSatisfied: () => boolean, timeoutMs = 1000): Promise<void> => {
    const start = Date.now();

    while (!isSatisfied()) {
        if (Date.now() - start > timeoutMs) {
            throw new Error("waitFor timed out");
        }

        await new Promise((resolve) => setTimeout(resolve, 10));
    }
};

const parseLines = (lines: string[]): Record<string, unknown>[] =>
    lines.map((line) => JSON.parse(line) as Record<string, unknown>);

const writeLine = (ctx: ServerContext, message: Record<string, unknown>): void => {
    ctx.sockets[0]?.write(`${JSON.stringify(message)}\n`);
};

const createClient = (ctx: ServerContext): McpClient =>
    new McpClient({ socketPath: ctx.socketPath, applicationId: "com.test.app" });

const spyStderr = () => vi.spyOn(process.stderr, "write").mockImplementation(() => true);

const stderrText = (stderrSpy: MockInstance<typeof process.stderr.write>): string =>
    stderrSpy.mock.calls.map((call) => String(call[0])).join("");

function assertLine(line: Record<string, unknown> | undefined): asserts line is Record<string, unknown> {
    if (!line) {
        throw new Error("expected a protocol line to be present");
    }
}

const beginRegistration = async (ctx: ServerContext): Promise<PendingRegistration> => {
    const client = createClient(ctx);
    const connectPromise = client.connect();
    await waitFor(() => ctx.received[0]?.length === 1);
    const [registerLine] = parseLines(ctx.received[0] ?? []);

    return { client, connectPromise, registerLine };
};

const respondToRegister = (ctx: ServerContext, registration: PendingRegistration): void => {
    writeLine(ctx, { id: registration.registerLine?.id, result: {} });
};

const connectAndRegister = async (ctx: ServerContext): Promise<McpClient> => {
    const registration = await beginRegistration(ctx);
    respondToRegister(ctx, registration);
    await registration.connectPromise;

    return registration.client;
};

const registerWithApp = async (ctx: ServerContext): Promise<McpClient> => {
    hoisted.getDefault.mockReturnValue(new hoisted.FakeApplication());

    return connectAndRegister(ctx);
};

const registerWithStderrSpy = async (ctx: ServerContext) => {
    const stderrSpy = spyStderr();
    const client = await connectAndRegister(ctx);

    return { stderrSpy, client };
};

const sendRequest = async (ctx: ServerContext, request: Record<string, unknown>): Promise<Record<string, unknown>> => {
    writeLine(ctx, request);
    await waitFor(() => ctx.received[0]?.length === 2);
    const [, responseLine] = parseLines(ctx.received[0] ?? []);
    assertLine(responseLine);
    expect(responseLine.id).toBe(request.id);

    return responseLine;
};

vi.mock("@gtkx/gi/gtk", () => ({
    AccessibleRole: {} as Record<string, number>,
    Window: { listToplevels: hoisted.listToplevels },
    Application: hoisted.FakeApplication,
}));

vi.mock("@gtkx/gi/gio", () => ({
    Application: { getDefault: hoisted.getDefault },
}));

describe("McpClient.connect", () => {
    it("connects and sends an app.register request as its first message", async () => {
        const { client, connectPromise, registerLine } = await beginRegistration(fixture.ctx);
        assertLine(registerLine);
        expect(registerLine.method).toBe("app.register");
        const params = registerLine.params as { applicationId: string; pid: number; projectRoot: string };
        expect(params.applicationId).toBe("com.test.app");
        expect(params.pid).toBe(process.pid);
        expect(params.projectRoot).toBe(process.cwd());
        writeLine(fixture.ctx, { id: registerLine.id, result: {} });
        await connectPromise;
        client.disconnect();
    });
});

describe("McpClient response correlation", () => {
    it("ignores responses whose ids do not match any pending request", async () => {
        const registration = await beginRegistration(fixture.ctx);
        writeLine(fixture.ctx, { id: "unknown-id", result: { stale: true } });
        respondToRegister(fixture.ctx, registration);
        await expect(registration.connectPromise).resolves.toBeUndefined();
        registration.client.disconnect();
    });
});

describe("McpClient incoming requests", () => {
    it(
        "responds to inbound requests with a method-not-found error when the application is not initialized",
        async () => {
            hoisted.getDefault.mockReturnValue(null);
            const client = await connectAndRegister(fixture.ctx);

            const responseLine = await sendRequest(fixture.ctx, {
                id: "req-1",
                method: "widget.click",
                params: { widgetId: "x" },
            });

            expect((responseLine.error as { message: string }).message).toMatch(/not initialized/);
            client.disconnect();
        },
    );

    it("ignores malformed JSON without crashing the socket", async () => {
        const registered = await registerWithStderrSpy(fixture.ctx);
        fixture.ctx.sockets[0]?.write("not json\n");
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(stderrText(registered.stderrSpy)).toContain("invalid JSON");
        registered.stderrSpy.mockRestore();
        registered.client.disconnect();
    });

    it("dispatches an inbound request and returns its result when the app is initialized", async () => {
        const client = await registerWithApp(fixture.ctx);
        const responseLine = await sendRequest(fixture.ctx, { id: "req-ok", method: "app.getWindows" });
        expect((responseLine.result as { windows: unknown[] }).windows).toEqual([]);
        client.disconnect();
    });

    it("returns a structured error code when dispatch throws a ProtocolError", async () => {
        const client = await registerWithApp(fixture.ctx);
        const responseLine = await sendRequest(fixture.ctx, { id: "req-bad", method: "does.not.exist" });
        expect(typeof (responseLine.error as { code: number }).code).toBe("number");
        expect((responseLine.error as { message: string }).message).toMatch(/does\.not\.exist/);
        client.disconnect();
    });
});

describe("McpClient.disconnect", () => {
    it("sends app.unregister before closing the socket", async () => {
        const client = await connectAndRegister(fixture.ctx);
        client.disconnect();
        await waitFor(() => fixture.ctx.received[0]?.length === 2);
        const [, unregisterLine] = parseLines(fixture.ctx.received[0] ?? []);
        expect(unregisterLine?.method).toBe("app.unregister");
    });

    it("rejects an in-flight connect() promise when disconnect is called first", async () => {
        const client = createClient(fixture.ctx);
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
        const stderrSpy = spyStderr();
        const { client, connectPromise, registerLine } = await beginRegistration(fixture.ctx);
        writeLine(fixture.ctx, { id: registerLine?.id, error: { code: -1, message: "refused" } });
        await expect(connectPromise).rejects.toThrow();
        stderrSpy.mockRestore();
        client.disconnect();
    });

    it("schedules a reconnect when the server drops an established connection", async () => {
        const registered = await registerWithStderrSpy(fixture.ctx);
        fixture.ctx.sockets[0]?.destroy();

        await vi.waitFor(() => {
            expect(stderrText(registered.stderrSpy)).toContain("Disconnected");
        });

        registered.stderrSpy.mockRestore();
        registered.client.disconnect();
    });
});
