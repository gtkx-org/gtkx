import EventEmitter from "node:events";
import type { Socket } from "node:net";
import type { Duplex } from "node:stream";
import { invalidRequestError, ipcTimeoutError, isMcpErrorCode, McpError, McpErrorCode } from "./protocol/errors.js";
import {
    type IpcMessage,
    type IpcRequest,
    IpcRequestSchema,
    type IpcResponse,
    IpcResponseSchema,
} from "./protocol/types.js";

export type JsonStreamTransportEvents = {
    request: [IpcRequest];
    invalid: [{ id: string; error: McpError }];
};

type PendingRequest = {
    resolve: (result: unknown) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
};

export class TransportClosedError extends Error {
    constructor() {
        super("Transport stream is not writable");
        this.name = "TransportClosedError";
    }
}

export class JsonStreamTransport extends EventEmitter<JsonStreamTransportEvents> {
    private buffer = "";
    private pending: Map<string, PendingRequest> = new Map();
    private writer: Duplex;

    constructor(writer: Duplex) {
        super();
        this.writer = writer;
    }

    feed(data: Buffer | string): void {
        this.buffer += typeof data === "string" ? data : data.toString();

        let newlineIndex = this.buffer.indexOf("\n");
        while (newlineIndex !== -1) {
            const line = this.buffer.slice(0, newlineIndex);
            this.buffer = this.buffer.slice(newlineIndex + 1);

            if (line.trim()) {
                this.processLine(line);
            }
            newlineIndex = this.buffer.indexOf("\n");
        }
    }

    send(message: IpcMessage): void {
        if (!this.writer.writable) return;
        this.writer.write(`${JSON.stringify(message)}\n`);
    }

    static fromSocket(
        socket: Socket,
        options: {
            onClose?: () => void;
            onError?: (error: Error) => void;
        } = {},
    ): JsonStreamTransport {
        const transport = new JsonStreamTransport(socket);
        socket.on("data", (data: Buffer) => transport.feed(data));
        socket.on("close", () => {
            transport.rejectPending(new Error("Connection closed"));
            options.onClose?.();
        });
        if (options.onError) {
            socket.on("error", options.onError);
        }
        return transport;
    }

    sendRequest<T = unknown>(method: string, params: unknown, timeoutMs: number): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            if (!this.writer.writable) {
                reject(new TransportClosedError());
                return;
            }

            const id = crypto.randomUUID();
            const timeout = setTimeout(() => {
                this.pending.delete(id);
                reject(ipcTimeoutError(timeoutMs));
            }, timeoutMs);

            this.pending.set(id, {
                resolve: resolve as (result: unknown) => void,
                reject,
                timeout,
            });

            this.send({ id, method, params });
            if (!this.writer.writable) {
                clearTimeout(timeout);
                this.pending.delete(id);
                reject(new TransportClosedError());
            }
        });
    }

    rejectPending(error: Error): void {
        for (const entry of this.pending.values()) {
            clearTimeout(entry.timeout);
            entry.reject(error);
        }
        this.pending.clear();
    }

    private processLine(line: string): void {
        let parsed: unknown;
        try {
            parsed = JSON.parse(line);
        } catch {
            this.emit("invalid", { id: "unknown", error: invalidRequestError("Invalid JSON") });
            return;
        }

        const message = parsed as Record<string, unknown>;
        if (typeof message["method"] === "string") {
            const requestResult = IpcRequestSchema.safeParse(parsed);
            if (requestResult.success) {
                this.emit("request", requestResult.data);
                return;
            }
        } else {
            const responseResult = IpcResponseSchema.safeParse(parsed);
            if (responseResult.success) {
                this.handleResponse(responseResult.data);
                return;
            }
        }

        const id = typeof message["id"] === "string" ? message["id"] : "unknown";
        this.emit("invalid", { id, error: invalidRequestError("Invalid message format") });
    }

    private handleResponse(response: IpcResponse): void {
        const entry = this.pending.get(response.id);
        if (!entry) return;

        clearTimeout(entry.timeout);
        this.pending.delete(response.id);

        if (response.error) {
            const err = response.error;
            entry.reject(
                new McpError(isMcpErrorCode(err.code) ? err.code : McpErrorCode.INTERNAL_ERROR, err.message, err.data),
            );
        } else {
            entry.resolve(response.result);
        }
    }
}

export type AppConnection = {
    id: string;
    transport: JsonStreamTransport;
};

export type AppTransportEvents = {
    connection: [AppConnection];
    disconnection: [AppConnection];
    request: [AppConnection, IpcRequest];
    error: [Error];
};

export interface AppTransport extends EventEmitter<AppTransportEvents> {
    send(connectionId: string, message: IpcMessage): void;
}
