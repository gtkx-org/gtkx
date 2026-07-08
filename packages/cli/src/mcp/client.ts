import * as net from "node:net";
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { DEFAULT_SOCKET_PATH, ErrorCode, ProtocolConnection, ProtocolError, type Request } from "@gtkx/mcp/internal";
import { error, errorMessage, info, normalizeError, warn } from "@gtkx/utils";
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
    private connection: ProtocolConnection | null = null;
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
        this.connection?.rejectPending(new Error("Client disconnected"));
        if (this.socket) {
            this.connection?.write({ id: crypto.randomUUID(), method: "app.unregister" });
            this.socket.destroy();
            this.socket = null;
        }
        this.connection = null;
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

        const connection = ProtocolConnection.fromSocket(socket, {
            onClose: () => {
                if (this.hasConnected) {
                    info("Disconnected from MCP server");
                    this.hasConnected = false;
                }
                this.socket = null;
                this.connection = null;
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
        connection.on("request", (request) => {
            this.handleRequest(request).catch((cause) => {
                error("Error handling request:", cause);
            });
        });
        connection.on("invalid", ({ error: parseError }) => {
            warn(`Received invalid JSON from MCP server: ${parseError.message}`);
        });

        this.socket = socket;
        this.connection = connection;
    }

    private scheduleReconnect(): void {
        if (this.reconnectTimer || this.isStopping) return;
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.attemptConnect();
        }, RECONNECT_DELAY_MS);
    }

    private register(): Promise<unknown> {
        if (!this.connection) {
            return Promise.reject(new Error("Connection not initialized"));
        }
        return this.connection.send(
            "app.register",
            {
                applicationId: this.applicationId,
                pid: process.pid,
            },
            REGISTER_TIMEOUT_MS,
        );
    }

    private async handleRequest(request: Request): Promise<void> {
        const { id, method, params } = request;
        const connection = this.connection;
        if (!connection) return;

        try {
            const defaultApp = Gio.Application.getDefault();
            if (!(defaultApp instanceof Gtk.Application)) {
                throw new TypeError("Application not initialized");
            }
            this.registry.refresh();
            const result = await dispatch(method, params, { app: defaultApp, registry: this.registry });
            connection.write({ id, result });
        } catch (error) {
            if (error instanceof ProtocolError) {
                connection.write({ id, error: error.toErrorObject() });
            } else {
                connection.write({
                    id,
                    error: {
                        code: ErrorCode.INTERNAL_ERROR,
                        message: errorMessage(error),
                    },
                });
            }
        }
    }
}
