import EventEmitter from "node:events";
import type { Socket } from "node:net";
import type { IpcMessage } from "./protocol/types.js";
import { type AppConnection, type AppTransport, type AppTransportEvents, JsonStreamTransport } from "./transport.js";

/**
 * Tracks connected GTKX apps as {@link AppConnection}s and routes per-frame
 * traffic through their {@link JsonStreamTransport}s. Lives entirely in
 * memory; the surrounding transport (Unix-domain socket, TCP, an in-memory
 * mock for tests) is responsible for accepting raw sockets and handing them
 * to {@link register}.
 */
export class ConnectionRegistry extends EventEmitter<AppTransportEvents> implements AppTransport {
    private readonly connections: Map<string, AppConnection> = new Map();

    /**
     * Wraps `socket` with a {@link JsonStreamTransport}, tracks the resulting
     * {@link AppConnection}, and emits `"connection"`. The transport is also
     * pre-wired so frame errors are echoed back to the peer.
     *
     * @param socket - The accepted socket.
     * @returns The registered connection.
     */
    register(socket: Socket): AppConnection {
        const id = crypto.randomUUID();
        const transport = JsonStreamTransport.fromSocket(socket, {
            onClose: () => {
                this.connections.delete(id);
                this.emit("disconnection", connection);
            },
            onError: (error) => this.emit("error", error),
        });
        const connection: AppConnection = { id, transport };
        this.connections.set(id, connection);
        transport.on("request", (request) => this.emit("request", connection, request));
        transport.on("invalid", ({ id: badId, error }) => {
            transport.send({ id: badId, error: error.toIpcError() });
        });
        this.emit("connection", connection);
        return connection;
    }

    send(connectionId: string, message: IpcMessage): void {
        const connection = this.connections.get(connectionId);
        if (!connection) return;
        connection.transport.send(message);
    }

    /**
     * Rejects every in-flight request on every tracked connection with
     * `reason`. Used during server teardown so callers waiting on a response
     * do not hang past shutdown.
     *
     * @param reason - Message attached to the rejection error.
     */
    closeAll(reason: string): void {
        for (const connection of this.connections.values()) {
            connection.transport.rejectPending(new Error(reason));
        }
    }

    /**
     * Drops the internal connection table without notifying peers. Intended
     * for use after the surrounding server has closed its listening socket.
     */
    clear(): void {
        this.connections.clear();
    }
}
