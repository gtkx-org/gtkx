import * as net from "node:net";
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { DEFAULT_SOCKET_PATH, type IpcRequest, JsonStreamTransport, McpError, McpErrorCode } from "@gtkx/mcp";
import { errorMessage, normalizeError } from "@gtkx/utils";
import { error, info, warn } from "../internal/log.js";
import { dispatch } from "./handlers.js";
import { WidgetRegistry } from "./widget-registry.js";

export type McpClientOptions = {
    socketPath?: string;
    applicationId: string;
};

const RECONNECT_DELAY_MS = 2000;
const REGISTER_TIMEOUT_MS = 30000;

export class McpClient {
    private socket: net.Socket | null = null;
    private transport: JsonStreamTransport | null = null;
    private socketPath: string;
    private applicationId: string;
    private reconnectTimer: NodeJS.Timeout | null = null;
    private hasConnected = false;
    private isStopping = false;
    private pendingConnectReject: ((error: Error) => void) | null = null;
    private registry = new WidgetRegistry();

    constructor(options: McpClientOptions) {
        this.socketPath = options.socketPath ?? DEFAULT_SOCKET_PATH;
        this.applicationId = options.applicationId;
    }

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
            info(`Connected to MCP server at ${this.socketPath}`);
            this.hasConnected = true;
            this.register()
                .then(() => {
                    info("Registered with MCP server");
                    settle(onSuccess);
                })
                .catch((cause) => {
                    error("Failed to register with MCP server:", cause.message);
                    settle(onError, normalizeError(cause));
                });
        });

        const transport = JsonStreamTransport.fromSocket(socket, {
            onClose: () => {
                if (this.hasConnected) {
                    info("Disconnected from MCP server");
                    this.hasConnected = false;
                }
                this.socket = null;
                this.transport = null;
                this.scheduleReconnect();
            },
            onError: (socketError) => {
                const code = (socketError as NodeJS.ErrnoException).code;
                const isDisconnectError =
                    code === "ENOENT" || code === "ECONNREFUSED" || code === "EPIPE" || code === "ECONNRESET";
                if (isDisconnectError) {
                    this.scheduleReconnect();
                } else {
                    error("Socket error:", socketError.message);
                }
                settle(onError, socketError);
            },
        });
        transport.on("request", (request) => {
            this.handleRequest(request).catch((cause) => {
                error("Error handling request:", cause);
            });
        });
        transport.on("invalid", ({ error: parseError }) => {
            warn(`Received invalid JSON from MCP server: ${parseError.message}`);
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
        return this.transport.sendRequest(
            "app.register",
            {
                applicationId: this.applicationId,
                pid: process.pid,
            },
            REGISTER_TIMEOUT_MS,
        );
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
