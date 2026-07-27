import { describe, expect, it } from "vitest";
import type { Message } from "../src/protocol/schemas.js";
import {
    collectFirstFrame,
    connectClient,
    setupSocketServer,
    socketCtx,
    waitForConnection,
} from "./socket-server-harness.js";

describe("ConnectionRegistry", () => {
    describe("ConnectionRegistry send", () => {
        setupSocketServer();

        it("silently drops a message for an unknown connection id", async () => {
            await socketCtx.server.start();

            expect(() => {
                socketCtx.registry.send("missing", { id: "x", method: "noop" });
            }).not.toThrow();
        });

        it("delivers a message to the connected client", async () => {
            const { server, socketPath, registry } = socketCtx;
            await server.start();
            const connectionPromise = waitForConnection(registry);
            const client = await connectClient(socketPath);
            const connection = await connectionPromise;

            const parsed = await collectFirstFrame<Message>(client, () => {
                registry.send(connection.id, { id: "out-1", result: 42 });
            },
            );

            expect((parsed).id).toBe("out-1");
        });
    });

    describe("ConnectionRegistry shutdown", () => {
        setupSocketServer();

        it("rejects in-flight requests and drains the connection when dispose runs", async () => {
            const { server, socketPath, registry } = socketCtx;
            await server.start();
            const connectionPromise = waitForConnection(registry);
            await connectClient(socketPath);
            const connection = await connectionPromise;
            const pending = connection.send("ping", {}, 5000);

            const disconnection: Promise<void> = new Promise((resolve) => {
                registry.addEventListener("disconnection", () => {
                    resolve();
                }, { once: true });
            });

            registry.dispose("Server stopping");
            await expect(pending).rejects.toThrow("Server stopping");
            await disconnection;
        });
    });
});
