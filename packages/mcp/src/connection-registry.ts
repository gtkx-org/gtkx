import EventEmitter from "node:events";
import type { Socket } from "node:net";
import type { IpcMessage } from "./protocol/types.js";
import { type AppConnection, type AppTransport, type AppTransportEvents, JsonStreamTransport } from "./transport.js";

export class ConnectionRegistry extends EventEmitter<AppTransportEvents> implements AppTransport {
    private connections: Map<string, AppConnection> = new Map();

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

    closeAll(reason: string): void {
        for (const connection of this.connections.values()) {
            connection.transport.rejectPending(new Error(reason));
        }
    }

    clear(): void {
        this.connections.clear();
    }
}
