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
    private sockets: Map<string, Socket> = new Map();

    onRequest: ConnectionRequestHandler = (_connection, request) => Promise.reject(methodNotFoundError(request.method));

    register(socket: Socket): ProtocolConnection {
        const connection = ProtocolConnection.fromSocket(socket, {
            onClose: () => {
                this.sockets.delete(connection.id);
                this.dispatchEvent(connectionDisconnectionEvent(connection));
            },
            onError: (error) => this.dispatchEvent(connectionErrorEvent(error)),
        });

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
