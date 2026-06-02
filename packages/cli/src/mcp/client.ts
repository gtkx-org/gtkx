import * as net from "node:net";
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { DEFAULT_SOCKET_PATH, type IpcRequest, JsonStreamTransport, McpError, McpErrorCode } from "@gtkx/mcp";
import { errorMessage } from "@gtkx/utils";
import { dispatch } from "./handlers.js";
import { WidgetRegistry } from "./widget-registry.js";

/**
 * Options for constructing an {@link McpClient}.
 */
export type McpClientOptions = {
    /** Socket path to connect to; defaults to `@gtkx/mcp`'s {@link DEFAULT_SOCKET_PATH}. */
    socketPath?: string;
    /** The GTK application ID the client should register with. */
    applicationId: string;
};

const RECONNECT_DELAY_MS = 2000;

/**
 * Connects a GTKX app to the MCP socket server.
 *
 * Owns the socket lifecycle (connect, reconnect, disconnect) and routes
 * inbound requests through {@link dispatch}. Wire framing and pending-request
 * correlation are delegated to {@link JsonStreamTransport}, the same class
 * the MCP server uses on its end — so both sides agree exactly on how a
 * frame is bounded, parsed, and resolved.
 */
export class McpClient {
    private socket: net.Socket | null = null;
    private transport: JsonStreamTransport | null = null;
    private readonly socketPath: string;
    private readonly applicationId: string;
    private reconnectTimer: NodeJS.Timeout | null = null;
    private hasConnected = false;
    private isStopping = false;
    private pendingConnectReject: ((error: Error) => void) | null = null;
    private readonly registry = new WidgetRegistry();

    constructor(options: McpClientOptions) {
        this.socketPath = options.socketPath ?? DEFAULT_SOCKET_PATH;
        this.applicationId = options.applicationId;
    }

    /**
     * Establishes the initial connection and registers this app with the
     * MCP server. Subsequent disconnects are handled transparently by the
     * built-in reconnect timer.
     */
    async connect(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.pendingConnectReject = reject;
            this.attemptConnect(
                () => {
                    this.pendingConnectReject = null;
                    resolve();
                },
                (error) => {
                    this.pendingConnectReject = null;
                    reject(error);
                },
            );
        });
    }

    /**
     * Tears down the socket and cancels any pending reconnect timer. Rejects
     * an in-flight {@link connect} call with a disconnect error so callers
     * waiting on registration do not hang past teardown.
     */
    disconnect(): void {
        this.isStopping = true;
        if (this.pendingConnectReject) {
            this.pendingConnectReject(new Error("Client disconnected before connection registered"));
            this.pendingConnectReject = null;
        }
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        this.transport?.rejectPending(new Error("Client disconnected"));
        if (this.socket) {
            this.transport?.send({ id: crypto.randomUUID(), method: "app.unregister" });
            this.socket.destroy();
            this.socket = null;
        }
        this.transport = null;
        this.hasConnected = false;
    }

    private attemptConnect(onSuccess?: () => void, onError?: (error: Error) => void): void {
        let settled = false;

        const settle = <T extends unknown[]>(callback: ((...args: T) => void) | undefined, ...args: T) => {
            if (settled) return;
            settled = true;
            callback?.(...args);
        };

        const socket = net.createConnection(this.socketPath, () => {
            console.log(`[gtkx] Connected to MCP server at ${this.socketPath}`);
            this.hasConnected = true;
            this.register()
                .then(() => {
                    console.log("[gtkx] Registered with MCP server");
                    settle(onSuccess);
                })
                .catch((error) => {
                    console.error("[gtkx] Failed to register with MCP server:", error.message);
                    settle(onError, error instanceof Error ? error : new Error(String(error)));
                });
        });

        const transport = JsonStreamTransport.fromSocket(socket, {
            onClose: () => {
                if (this.hasConnected) {
                    console.log("[gtkx] Disconnected from MCP server");
                    this.hasConnected = false;
                }
                this.socket = null;
                this.transport = null;
                this.scheduleReconnect();
            },
            onError: (error) => {
                const code = (error as NodeJS.ErrnoException).code;
                const isDisconnectError =
                    code === "ENOENT" || code === "ECONNREFUSED" || code === "EPIPE" || code === "ECONNRESET";
                if (isDisconnectError) {
                    this.scheduleReconnect();
                } else {
                    console.error("[gtkx] Socket error:", error.message);
                }
                settle(onError, error);
            },
        });
        transport.on("request", (request) => {
            this.handleRequest(request).catch((error) => {
                console.error("[gtkx] Error handling request:", error);
            });
        });
        transport.on("invalid", ({ error }) => {
            console.warn(`[gtkx] Received invalid JSON from MCP server: ${error.message}`);
        });

        this.socket = socket;
        this.transport = transport;
    }

    private scheduleReconnect(): void {
        if (this.reconnectTimer || this.isStopping) return;
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.attemptConnect();
        }, RECONNECT_DELAY_MS);
    }

    private register(): Promise<unknown> {
        if (!this.transport) {
            return Promise.reject(new Error("Transport not initialized"));
        }
        return this.transport.sendRequest("app.register", {
            applicationId: this.applicationId,
            pid: process.pid,
        });
    }

    private async handleRequest(request: IpcRequest): Promise<void> {
        const { id, method, params } = request;
        const transport = this.transport;
        if (!transport) return;

        try {
            const defaultApp = Gio.Application.getDefault();
            if (!(defaultApp instanceof Gtk.Application)) {
                throw new TypeError("Application not initialized");
            }
            this.registry.refresh();
            const result = await dispatch(method, params, { app: defaultApp, registry: this.registry });
            transport.send({ id, result });
        } catch (error) {
            if (error instanceof McpError) {
                transport.send({ id, error: error.toIpcError() });
            } else {
                transport.send({
                    id,
                    error: {
                        code: McpErrorCode.INTERNAL_ERROR,
                        message: errorMessage(error),
                    },
                });
            }
        }
    }
}
