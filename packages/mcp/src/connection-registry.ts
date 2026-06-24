import EventEmitter from "node:events";
import type { Socket } from "node:net";
import type { IpcMessage } from "./protocol/types.js";
import {
    type AppConnection,
    type AppConnectionEvents,
    type AppConnections,
    JsonStreamConnection,
} from "./transport.js";

export class ConnectionRegistry extends EventEmitter<AppConnectionEvents> implements AppConnections {
    private connections: Map<string, AppConnection> = new Map();

    register(socket: Socket): AppConnection {
        const id = crypto.randomUUID();
        const streamConnection = JsonStreamConnection.fromSocket(socket, {
            onClose: () => {
                this.connections.delete(id);
                this.emit("disconnection", connection);
            },
            onError: (error) => this.emit("error", error),
        });
        const connection: AppConnection = { id, connection: streamConnection };
        this.connections.set(id, connection);
        streamConnection.on("request", (request) => this.emit("request", connection, request));
        streamConnection.on("invalid", ({ id: badId, error }) => {
            streamConnection.write({ id: badId, error: error.toIpcError() });
        });
        return connection;
    }

    send(connectionId: string, message: IpcMessage): void {
        const connection = this.connections.get(connectionId);
        if (!connection) return;
        connection.connection.write(message);
    }

    closeAll(reason: string): void {
        for (const connection of this.connections.values()) {
            connection.connection.rejectPending(new Error(reason));
        }
    }

    clear(): void {
        this.connections.clear();
    }
}
