import type { Socket } from "node:net";
import type { Message } from "./protocol/schemas.js";
import {
    type AppConnections,
    connectionDisconnectionEvent,
    connectionErrorEvent,
    connectionRequestEvent,
    ProtocolConnection,
} from "./transport.js";

class ConnectionRegistry extends EventTarget implements AppConnections {
    private connections: Map<string, ProtocolConnection> = new Map();
    private sockets: Map<string, Socket> = new Map();

    register(socket: Socket): ProtocolConnection {
        const connection = ProtocolConnection.fromSocket(socket, {
            onClose: () => {
                this.connections.delete(connection.id);
                this.sockets.delete(connection.id);
                this.dispatchEvent(connectionDisconnectionEvent(connection));
            },
            onError: (error) => this.dispatchEvent(connectionErrorEvent(error)),
        });

        this.connections.set(connection.id, connection);
        this.sockets.set(connection.id, socket);
        connection.on("request", (request) => this.dispatchEvent(connectionRequestEvent(connection, request)));

        connection.on("invalid", ({ id: badId, error }) => {
            connection.write({ id: badId, error: error.toErrorObject() });
        });

        return connection;
    }

    send(connectionId: string, message: Message): void {
        const connection = this.connections.get(connectionId);

        if (!connection) {
            return;
        }

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

export { ConnectionRegistry };
