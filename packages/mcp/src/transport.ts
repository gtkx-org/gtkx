import EventEmitter from "node:events";
import type { Socket } from "node:net";
import type { Duplex } from "node:stream";
import { ErrorCode, invalidRequestError, isErrorCode, ProtocolError, requestTimeoutError } from "./protocol/errors.js";
import { type Message, type Request, RequestSchema, type Response, ResponseSchema } from "./protocol/schemas.js";

export type ProtocolConnectionEvents = {
    request: [Request];
    invalid: [{ id: string; error: ProtocolError }];
};

type PendingRequest = {
    resolve: (result: unknown) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
};

export class ConnectionClosedError extends Error {
    constructor() {
        super("Connection stream is not writable");
        this.name = "ConnectionClosedError";
    }
}

export class ProtocolConnection extends EventEmitter<ProtocolConnectionEvents> {
    id: string = crypto.randomUUID();
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

    write(message: Message): void {
        if (!this.writer.writable) return;
        this.writer.write(`${JSON.stringify(message)}\n`);
    }

    static fromSocket(
        socket: Socket,
        options: {
            onClose?: () => void;
            onError?: (error: Error) => void;
        } = {},
    ): ProtocolConnection {
        const connection = new ProtocolConnection(socket);
        socket.on("data", (data: Buffer) => connection.feed(data));
        socket.on("close", () => {
            connection.rejectPending(new Error("Connection closed"));
            options.onClose?.();
        });
        if (options.onError) {
            socket.on("error", options.onError);
        }
        return connection;
    }

    send<T = unknown>(method: string, params: unknown, timeout: number): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            if (!this.writer.writable) {
                reject(new ConnectionClosedError());
                return;
            }

            const id = crypto.randomUUID();
            const timeoutHandle = setTimeout(() => {
                this.pending.delete(id);
                reject(requestTimeoutError(timeout));
            }, timeout);

            this.pending.set(id, {
                resolve: resolve as (result: unknown) => void,
                reject,
                timeout: timeoutHandle,
            });

            this.write({ id, method, params });
            if (!this.writer.writable) {
                clearTimeout(timeoutHandle);
                this.pending.delete(id);
                reject(new ConnectionClosedError());
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
        if (typeof message.method === "string") {
            const requestResult = RequestSchema.safeParse(parsed);
            if (requestResult.success) {
                this.emit("request", requestResult.data);
                return;
            }
        } else {
            const responseResult = ResponseSchema.safeParse(parsed);
            if (responseResult.success) {
                this.handleResponse(responseResult.data);
                return;
            }
        }

        const id = typeof message.id === "string" ? message.id : "unknown";
        this.emit("invalid", { id, error: invalidRequestError("Invalid message format") });
    }

    private handleResponse(response: Response): void {
        const entry = this.pending.get(response.id);
        if (!entry) return;

        clearTimeout(entry.timeout);
        this.pending.delete(response.id);

        if (response.error) {
            const err = response.error;
            entry.reject(
                new ProtocolError(isErrorCode(err.code) ? err.code : ErrorCode.INTERNAL_ERROR, err.message, err.data),
            );
        } else {
            entry.resolve(response.result);
        }
    }
}

export type AppConnectionEvents = {
    disconnection: [ProtocolConnection];
    request: [ProtocolConnection, Request];
    error: [Error];
};

export interface AppConnections extends EventEmitter<AppConnectionEvents> {
    send(connectionId: string, message: Message): void;
}
