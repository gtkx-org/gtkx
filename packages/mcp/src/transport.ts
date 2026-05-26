import EventEmitter from "node:events";
import type { Socket } from "node:net";
import { invalidRequestError, ipcTimeoutError, McpError, type McpErrorCode } from "./protocol/errors.js";
import {
    type IpcMessage,
    type IpcRequest,
    IpcRequestSchema,
    type IpcResponse,
    IpcResponseSchema,
} from "./protocol/types.js";

/**
 * Minimum interface a {@link JsonStreamTransport} needs to write framed JSON
 * to its underlying stream. Implemented by `net.Socket` directly.
 */
export interface FrameWriter {
    /** Writes a single chunk; returns `true` if the chunk was flushed. */
    write(line: string): boolean;
    /** Whether the underlying stream is currently writable. */
    readonly writable: boolean;
}

/**
 * Events emitted by a {@link JsonStreamTransport} for a single peer.
 */
export type JsonStreamTransportEvents = {
    /** A well-formed {@link IpcRequest} arrived from the peer. */
    request: [IpcRequest];
    /** A frame failed JSON parsing or schema validation. */
    invalid: [{ id: string; error: McpError }];
};

type PendingRequest = {
    resolve: (result: unknown) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
};

const DEFAULT_REQUEST_TIMEOUT_MS = 30000;

/**
 * Error thrown by {@link JsonStreamTransport.sendRequest} when the underlying
 * stream is not writable. Callers translate this to a domain-level error
 * (typically `connectionWriteFailedError`).
 */
export class TransportClosedError extends Error {
    constructor() {
        super("Transport stream is not writable");
        this.name = "TransportClosedError";
    }
}

/**
 * Newline-delimited JSON transport for a single peer.
 *
 * Owns the receive buffer, frame parsing, schema validation, the outbound
 * pending-request map, and the framed `send`. Used identically by the MCP
 * server (one per accepted connection) and by the GTKX-side client (a single
 * instance wrapping its outgoing socket).
 */
export class JsonStreamTransport extends EventEmitter<JsonStreamTransportEvents> {
    private buffer = "";
    private readonly pending: Map<string, PendingRequest> = new Map();
    private readonly writer: FrameWriter;
    private readonly defaultTimeout: number;

    constructor(writer: FrameWriter, options: { requestTimeout?: number } = {}) {
        super();
        this.writer = writer;
        this.defaultTimeout = options.requestTimeout ?? DEFAULT_REQUEST_TIMEOUT_MS;
    }

    /**
     * Feeds a chunk of raw stream bytes into the framing buffer. Emits
     * `request` for every complete inbound request frame and resolves a
     * pending promise for every matching response frame.
     */
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

    /**
     * Writes a framed JSON message. Silently drops the message if the stream
     * is not writable; callers that need a hard failure should use
     * {@link sendRequest}, which throws {@link TransportClosedError} in that
     * case.
     */
    send(message: IpcMessage): void {
        if (!this.writer.writable) return;
        this.writer.write(`${JSON.stringify(message)}\n`);
    }

    /**
     * Wraps an open {@link Socket} with a new {@link JsonStreamTransport} and
     * pre-wires the common data/close/error plumbing both the MCP server and
     * its GTKX-side client need: `data` is fed into the framing buffer,
     * `close` rejects every in-flight request, and `error` is forwarded to
     * the caller-supplied handler. Callers attach their own `request` /
     * `invalid` / additional close listeners on the returned instance.
     *
     * @param socket - The connected socket.
     * @param options - Hooks invoked after the built-in close / error
     *   plumbing runs.
     * @returns The transport bound to `socket`.
     */
    static fromSocket(
        socket: Socket,
        options: {
            onClose?: () => void;
            onError?: (error: Error) => void;
            closeReason?: string;
        } = {},
    ): JsonStreamTransport {
        const transport = new JsonStreamTransport(socket);
        socket.on("data", (data: Buffer) => transport.feed(data));
        socket.on("close", () => {
            transport.rejectPending(new Error(options.closeReason ?? "Connection closed"));
            options.onClose?.();
        });
        if (options.onError) {
            socket.on("error", options.onError);
        }
        return transport;
    }

    /**
     * Sends a request and resolves with the correlated response result.
     *
     * @throws {TransportClosedError} If the stream is not writable.
     * @throws {McpError} If the peer returned an error or the request timed
     *   out (`ipcTimeoutError`).
     */
    sendRequest<T = unknown>(method: string, params?: unknown, timeoutMs = this.defaultTimeout): Promise<T> {
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

    /**
     * Rejects every in-flight `sendRequest` promise with `error` and clears
     * the pending map. Call this when the underlying stream closes.
     */
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

        const id = typeof message.id === "string" ? message.id : "unknown";
        this.emit("invalid", { id, error: invalidRequestError("Invalid message format") });
    }

    private handleResponse(response: IpcResponse): void {
        const entry = this.pending.get(response.id);
        if (!entry) return;

        clearTimeout(entry.timeout);
        this.pending.delete(response.id);

        if (response.error) {
            const err = response.error;
            entry.reject(new McpError(err.code as McpErrorCode, err.message, err.data));
        } else {
            entry.resolve(response.result);
        }
    }
}

/**
 * Represents a single connected GTKX application from the MCP server's
 * point of view.
 */
export type AppConnection = {
    /** Stable identifier for the connection within the server. */
    id: string;
    /** Per-connection transport handling framing and pending requests. */
    transport: JsonStreamTransport;
};

/**
 * Events emitted by any multi-connection app transport (typically an
 * {@link AppTransport} implementation such as `SocketServer`).
 */
export type AppTransportEvents = {
    connection: [AppConnection];
    disconnection: [AppConnection];
    request: [AppConnection, IpcRequest];
    error: [Error];
};

/**
 * Generic interface for a server-side transport that accepts multiple app
 * connections. {@link import("./connection-manager.js").ConnectionManager}
 * depends on this interface rather than the concrete `SocketServer`,
 * leaving room for alternate transports (TCP, SSE, Worker, …).
 */
export interface AppTransport extends EventEmitter<AppTransportEvents> {
    /**
     * Writes a framed message to the connection identified by `connectionId`.
     * Silently drops the message if the connection is unknown or its stream
     * is no longer writable.
     */
    send(connectionId: string, message: IpcMessage): void;
}
