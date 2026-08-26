/* eslint-disable @typescript-eslint/no-empty-function -- the app link negotiates no MCP capabilities */
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { Socket } from "node:net";
import { normalizeError } from "@gtkx/utils";
import { Protocol } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { ReadBuffer, serializeMessage } from "@modelcontextprotocol/sdk/shared/stdio.js";
import {
    ErrorCode,
    type JSONRPCMessage,
    type JSONRPCRequest,
    McpError,
    type Notification,
    type Request,
    type Result,
    ResultSchema,
} from "@modelcontextprotocol/sdk/types.js";

type ConnectionEvent = CustomEvent<ProtocolConnection>;
type ConnectionErrorEvent = CustomEvent<Error>;
type ConnectionRequestHandler = (connection: ProtocolConnection, request: JSONRPCRequest) => Promise<Result>;
type RequestParams = Request["params"];

type ConnectionOptions = {
    onClose: () => void;
    onError: (error: Error) => void;
};

type AppConnections = {
    onRequest: ConnectionRequestHandler;
} & EventTarget;

function connectionDisconnectionEvent(connection: ProtocolConnection): ConnectionEvent {
    return new CustomEvent("disconnection", { detail: connection });
}

function connectionErrorEvent(error: Error): ConnectionErrorEvent {
    return new CustomEvent("error", { detail: error });
}

class SocketTransport implements Transport {
    private readBuffer: ReadBuffer = new ReadBuffer({ maxBufferSize: Infinity });
    private socket: Socket;

    onclose?: () => void;
    onerror?: (error: Error) => void;
    onmessage?: (message: JSONRPCMessage) => void;

    constructor(socket: Socket) {
        this.socket = socket;
    }

    private next(): JSONRPCMessage | null {
        try {
            return this.readBuffer.readMessage();
        } catch (error) {
            this.onerror?.(normalizeError(error));

            return null;
        }
    }

    private read(): void {
        for (let message = this.next(); message !== null; message = this.next()) {
            this.onmessage?.(message);
        }
    }

    start(): Promise<void> {
        this.socket.on("data", (chunk: Buffer) => {
            this.readBuffer.append(chunk);
            this.read();
        });

        this.socket.on("close", () => {
            this.onclose?.();
        });

        this.socket.on("error", (error) => {
            this.onerror?.(error);
        });

        return Promise.resolve();
    }

    send(message: JSONRPCMessage): Promise<void> {
        if (!this.socket.writable) {
            return Promise.reject(new McpError(ErrorCode.ConnectionClosed, "Connection stream is not writable"));
        }

        this.socket.write(serializeMessage(message));

        return Promise.resolve();
    }

    close(): Promise<void> {
        this.socket.destroy();

        return Promise.resolve();
    }
}

class ProtocolConnection extends Protocol<Request, Notification, Result> {
    static fromSocket(socket: Socket, options: ConnectionOptions): ProtocolConnection {
        const connection = Object.assign(new ProtocolConnection(), {
            onclose: options.onClose,
            onerror: options.onError,
        });

        void connection.connect(new SocketTransport(socket));

        return connection;
    }

    id: string = crypto.randomUUID();

    protected assertCapabilityForMethod(): void {}

    protected assertNotificationCapability(): void {}

    protected assertRequestHandlerCapability(): void {}

    protected assertTaskCapability(): void {}

    protected assertTaskHandlerCapability(): void {}

    async send<T>(method: string, params?: RequestParams, timeout?: number): Promise<T> {
        const result = await this.request(
            { method, ...(params !== undefined && { params }) },
            ResultSchema,
            { ...(timeout !== undefined && { timeout }) },
        );

        return result as T;
    }
}

export {
    connectionDisconnectionEvent,
    connectionErrorEvent,
    ProtocolConnection,
    type AppConnections,
    type ConnectionEvent,
    type ConnectionErrorEvent,
    type ConnectionRequestHandler,
    type RequestParams,
};
