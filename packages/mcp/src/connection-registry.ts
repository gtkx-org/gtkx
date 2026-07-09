import EventEmitter from "node:events";
import type { Socket } from "node:net";
import type { Message } from "./protocol/schemas.js";
import { type AppConnectionEvents, type AppConnections, ProtocolConnection } from "./transport.js";

export class ConnectionRegistry extends EventEmitter<AppConnectionEvents> implements AppConnections {
    private connections: Map<string, ProtocolConnection> = new Map();
    private sockets: Map<string, Socket> = new Map();

    register(socket: Socket): ProtocolConnection {
        const connection = ProtocolConnection.fromSocket(socket, {
            onClose: () => {
                this.connections.delete(connection.id);
                this.sockets.delete(connection.id);
                this.emit("disconnection", connection);
            },
            onError: (error) => this.emit("error", error),
        });
        this.connections.set(connection.id, connection);
        this.sockets.set(connection.id, socket);
        connection.on("request", (request) => this.emit("request", connection, request));
        connection.on("invalid", ({ id: badId, error }) => {
            connection.write({ id: badId, error: error.toErrorObject() });
        });
        return connection;
    }

    send(connectionId: string, message: Message): void {
        const connection = this.connections.get(connectionId);
        if (!connection) return;
        connection.write(message);
    }

    dispose(reason: string): void {
        for (const connection of this.connections.values()) {
            connection.rejectPending(new Error(reason));
        }
        for (const socket of this.sockets.values()) {
            socket.destroy();
        }
    }
}
