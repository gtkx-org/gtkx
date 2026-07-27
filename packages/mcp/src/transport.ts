import type { Socket } from "node:net";
import type { Duplex } from "node:stream";
import { ErrorCode, invalidRequestError, isErrorCode, ProtocolError, requestTimeoutError } from "./protocol/errors.js";
import { type Message, type Request, RequestSchema, type Response, ResponseSchema } from "./protocol/schemas.js";

type ProtocolConnectionEvents = {
    request: Request;
    invalid: { id: string; error: ProtocolError };
};

type PendingRequest = {
    resolve: (result: unknown) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
};

type ConnectionEvent = CustomEvent<ProtocolConnection>;
type ConnectionRequestEvent = CustomEvent<{ connection: ProtocolConnection; request: Request }>;
type ConnectionErrorEvent = CustomEvent<Error>;

type AppConnections = {
    send(connectionId: string, message: Message): void;
} & EventTarget;

function connectionRequestEvent(connection: ProtocolConnection, request: Request): ConnectionRequestEvent {
    return new CustomEvent("request", { detail: { connection, request } });
}

function connectionDisconnectionEvent(connection: ProtocolConnection): ConnectionEvent {
    return new CustomEvent("disconnection", { detail: connection });
}

function connectionErrorEvent(error: Error): ConnectionErrorEvent {
    return new CustomEvent("error", { detail: error });
}

class ConnectionClosedError extends Error {
    constructor() {
        super("Connection stream is not writable");
        this.name = "ConnectionClosedError";
    }
}

class ProtocolConnection extends EventTarget {
    static fromSocket(
        socket: Socket,
        options: {
            onClose?: () => void;
            onError?: (error: Error) => void;
        } = {},
    ): ProtocolConnection {
        const connection = new ProtocolConnection(socket);

        socket.on("data", (data: Buffer) => {
            connection.feed(data);
        });

        socket.on("close", () => {
            connection.rejectPending(new Error("Connection closed"));
            options.onClose?.();
        });

        if (options.onError) {
            socket.on("error", options.onError);
        }

        return connection;
    }

    private buffer = "";
    private pending: Map<string, PendingRequest> = new Map();
    private writer: Duplex;

    id: string = crypto.randomUUID();

    constructor(writer: Duplex) {
        super();
        this.writer = writer;
    }

    private notify<K extends keyof ProtocolConnectionEvents>(type: K, detail: ProtocolConnectionEvents[K]): void {
        this.dispatchEvent(new CustomEvent(type, { detail }));
    }

    private rejectWhenClosed(id: string, timeoutHandle: NodeJS.Timeout, reject: (error: Error) => void): void {
        if (this.writer.writable) {
            return;
        }

        clearTimeout(timeoutHandle);
        this.pending.delete(id);
        reject(new ConnectionClosedError());
    }

    private dispatchParsed(parsed: unknown): boolean {
        const message = parsed as Record<string, unknown>;

        if (typeof message.method === "string") {
            const requestResult = RequestSchema.safeParse(parsed);

            if (!requestResult.success) {
                return false;
            }

            this.notify("request", requestResult.data);

            return true;
        }

        const responseResult = ResponseSchema.safeParse(parsed);

        if (!responseResult.success) {
            return false;
        }

        this.handleResponse(responseResult.data);

        return true;
    }

    private processLine(line: string): void {
        let parsed: unknown;

        try {
            parsed = JSON.parse(line);
        } catch {
            this.notify("invalid", { id: "unknown", error: invalidRequestError("Invalid JSON") });

            return;
        }

        if (this.dispatchParsed(parsed)) {
            return;
        }

        const message = parsed as Record<string, unknown>;
        const id = typeof message.id === "string" ? message.id : "unknown";
        this.notify("invalid", { id, error: invalidRequestError("Invalid message format") });
    }

    private handleResponse(response: Response): void {
        const entry = this.pending.get(response.id);

        if (!entry) {
            return;
        }

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

    on<K extends keyof ProtocolConnectionEvents>(
        type: K,
        listener: (detail: ProtocolConnectionEvents[K]) => void,
    ): void {
        this.addEventListener(type, (event) => {
            listener((event as CustomEvent<ProtocolConnectionEvents[K]>).detail);
        });
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
        if (!this.writer.writable) {
            return;
        }

        this.writer.write(`${JSON.stringify(message)}\n`);
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
            this.rejectWhenClosed(id, timeoutHandle, reject);
        });
    }

    rejectPending(error: Error): void {
        for (const entry of this.pending.values()) {
            clearTimeout(entry.timeout);
            entry.reject(error);
        }

        this.pending.clear();
    }
}

export {
    ConnectionClosedError,
    connectionDisconnectionEvent,
    connectionErrorEvent,
    connectionRequestEvent,
    ProtocolConnection,
    type ProtocolConnectionEvents,
    type AppConnections,
    type ConnectionEvent,
    type ConnectionErrorEvent,
    type ConnectionRequestEvent,
};
