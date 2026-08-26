import type { Socket } from "node:net";
import { methodNotFoundError } from "./protocol/errors.js";
import {
    type AppConnections,
    connectionDisconnectionEvent,
    connectionErrorEvent,
    type ConnectionRequestHandler,
    ProtocolConnection,
} from "./transport.js";

class ConnectionRegistry extends EventTarget implements AppConnections {
    private connections: Map<string, ProtocolConnection> = new Map();
    private sockets: Map<string, Socket> = new Map();

    onRequest: ConnectionRequestHandler = (_connection, request) => Promise.reject(methodNotFoundError(request.method));

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
        connection.fallbackRequestHandler = (request) => this.onRequest(connection, request);

        return connection;
    }

    dispose(): void {
        for (const socket of this.sockets.values()) {
            socket.destroy();
        }
    }
}

export { ConnectionRegistry };
