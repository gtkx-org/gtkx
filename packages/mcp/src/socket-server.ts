import EventEmitter from "node:events";
import * as fs from "node:fs";
import * as net from "node:net";
import { invalidRequestError } from "./protocol/errors.js";
import {
    DEFAULT_SOCKET_PATH,
    type IpcMessage,
    type IpcRequest,
    IpcRequestSchema,
    type IpcResponse,
    IpcResponseSchema,
} from "./protocol/types.js";

type SocketServerEventMap = {
    connection: [AppConnection];
    disconnection: [AppConnection];
    request: [AppConnection, IpcRequest];
    response: [AppConnection, IpcResponse];
    error: [Error];
};

/**
 * Represents a connected application.
 */
export interface AppConnection {
    /** Unique connection identifier */
    id: string;
    /** The underlying socket */
    socket: net.Socket;
    /** Buffer for incomplete messages */
    buffer: string;
}

/**
 * Unix domain socket server for MCP communication.
 *
 * Manages connections from GTKX applications and handles IPC messaging.
 */
export class SocketServer extends EventEmitter<SocketServerEventMap> {
    private server: net.Server | null = null;
    private connections: Map<string, AppConnection> = new Map();
    private socketPath: string;

    constructor(socketPath: string = DEFAULT_SOCKET_PATH) {
        super();
        this.socketPath = socketPath;
    }

    get path(): string {
        return this.socketPath;
    }

    get isListening(): boolean {
        return this.server?.listening ?? false;
    }

    getConnections(): AppConnection[] {
        return Array.from(this.connections.values());
    }

    getConnection(id: string): AppConnection | undefined {
        return this.connections.get(id);
    }

    async start(): Promise<void> {
        if (this.server) {
            return;
        }

        if (fs.existsSync(this.socketPath)) {
            fs.unlinkSync(this.socketPath);
        }

        return new Promise((resolve, reject) => {
            this.server = net.createServer((socket) => this.handleConnection(socket));

            this.server.on("error", (error) => {
                this.emit("error", error);
                reject(error);
            });

            this.server.listen(this.socketPath, () => {
                resolve();
            });
        });
    }

    async stop(): Promise<void> {
        if (!this.server) {
            return;
        }

        for (const connection of this.connections.values()) {
            connection.socket.destroy();
        }
        this.connections.clear();

        return new Promise((resolve) => {
            this.server?.close(() => {
                this.server = null;
                if (fs.existsSync(this.socketPath)) {
                    fs.unlinkSync(this.socketPath);
                }
                resolve();
            });
        });
    }

    send(connectionId: string, message: IpcMessage): boolean {
        const connection = this.connections.get(connectionId);
        if (!connection || !connection.socket.writable) {
            return false;
        }

        const data = `${JSON.stringify(message)}\n`;
        connection.socket.write(data);
        return true;
    }

    private handleConnection(socket: net.Socket): void {
        const connectionId = crypto.randomUUID();
        const connection: AppConnection = {
            id: connectionId,
            socket,
            buffer: "",
        };

        this.connections.set(connectionId, connection);
        this.emit("connection", connection);

        socket.on("data", (data: Buffer) => this.handleData(connection, data));

        socket.on("close", () => {
            this.connections.delete(connectionId);
            this.emit("disconnection", connection);
        });

        socket.on("error", (error) => {
            this.emit("error", error);
        });
    }

    private handleData(connection: AppConnection, data: Buffer): void {
        connection.buffer += data.toString();

        let newlineIndex = connection.buffer.indexOf("\n");
        while (newlineIndex !== -1) {
            const line = connection.buffer.slice(0, newlineIndex);
            connection.buffer = connection.buffer.slice(newlineIndex + 1);

            if (line.trim()) {
                this.processMessage(connection, line);
            }
            newlineIndex = connection.buffer.indexOf("\n");
        }
    }

    private processMessage(connection: AppConnection, line: string): void {
        let parsed: unknown;
        try {
            parsed = JSON.parse(line);
        } catch {
            const response: IpcResponse = {
                id: "unknown",
                error: invalidRequestError("Invalid JSON").toIpcError(),
            };
            this.send(connection.id, response);
            return;
        }

        const message = parsed as Record<string, unknown>;
        const hasMethod = typeof message.method === "string";

        if (hasMethod) {
            const requestResult = IpcRequestSchema.safeParse(parsed);
            if (requestResult.success) {
                this.emit("request", connection, requestResult.data);
                return;
            }
        } else {
            const responseResult = IpcResponseSchema.safeParse(parsed);
            if (responseResult.success) {
                this.emit("response", connection, responseResult.data);
                return;
            }
        }

        const response: IpcResponse = {
            id: (message.id as string | undefined) ?? "unknown",
            error: invalidRequestError("Invalid message format").toIpcError(),
        };
        this.send(connection.id, response);
    }
}
