import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { DEFAULT_SOCKET_PATH, ErrorCode, ProtocolConnection, ProtocolError, type Request } from "@gtkx/mcp/internal";
import { error, errorMessage, info, normalizeError, warn } from "@gtkx/utils";
import * as net from "node:net";
import { dispatch } from "./handlers.js";
import { WidgetRegistry } from "./widget-registry.js";

type McpClientOptions = {
    socketPath?: string;
    applicationId: string;
};

type ConnectCallbacks = {
    onSuccess?: (() => void) | undefined;
    onError?: ((error: Error) => void) | undefined;
};

type ConnectSettler = {
    succeed: () => void;
    fail: (error: Error) => void;
};

const RECONNECT_DELAY_MS = 2000;
const REGISTER_TIMEOUT_MS = 30_000;
const DISCONNECT_ERROR_CODES: Set<string> = new Set(["ENOENT", "ECONNREFUSED", "EPIPE", "ECONNRESET"]);

const toResponseError = (error: unknown): { code: number; message: string; data?: unknown } =>
    error instanceof ProtocolError
        ? error.toErrorObject()
        : { code: ErrorCode.INTERNAL_ERROR, message: errorMessage(error) };

const connectSettler = (callbacks: ConnectCallbacks): ConnectSettler => {
    let isSettled = false;

    const settle = (notify: () => void): void => {
        if (isSettled) {
            return;
        }

        isSettled = true;
        notify();
    };

    return {
        succeed: () => {
            settle(() => callbacks.onSuccess?.());
        },
        fail: (failure) => {
            settle(() => callbacks.onError?.(failure));
        },
    };
};

class McpClient {
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

    private handleClose(): void {
        if (this.hasConnected) {
            info("Disconnected from MCP server");
            this.hasConnected = false;
        }

        this.socket = null;
        this.connection = null;
        this.scheduleReconnect();
    }

    private handleSocketError(socketError: Error): void {
        const code = (socketError as NodeJS.ErrnoException).code;

        if (code !== undefined && DISCONNECT_ERROR_CODES.has(code)) {
            this.scheduleReconnect();
        } else {
            error("Socket error:", socketError.message);
        }
    }

    private async registerWithServer(settle: ConnectSettler): Promise<void> {
        try {
            await this.register();
            info("Registered with MCP server");
            settle.succeed();
        } catch (registerError) {
            error("Failed to register with MCP server:", errorMessage(registerError));
            settle.fail(normalizeError(registerError));
        }
    }

    private attemptConnect(callbacks: ConnectCallbacks = {}): void {
        const settle = connectSettler(callbacks);

        const socket = net.createConnection(this.socketPath, () => {
            info(`Connected to MCP server at ${this.socketPath}`);
            this.hasConnected = true;
            void this.registerWithServer(settle);
        });

        const connection = ProtocolConnection.fromSocket(socket, {
            onClose: () => {
                this.handleClose();
            },
            onError: (socketError) => {
                this.handleSocketError(socketError);
                settle.fail(socketError);
            },
        });

        connection.on("request", (request) => {
            void this.handleRequest(request);
        });

        connection.on("invalid", ({ error: parseError }) => {
            warn(`Received invalid JSON from MCP server: ${parseError.message}`);
        });

        this.socket = socket;
        this.connection = connection;
    }

    private scheduleReconnect(): void {
        if (this.reconnectTimer || this.isStopping) {
            return;
        }

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
                projectRoot: process.cwd(),
            },
            REGISTER_TIMEOUT_MS,
        );
    }

    private async respondToRequest(request: Request): Promise<void> {
        const { id, method, params } = request;
        const connection = this.connection;

        if (!connection) {
            return;
        }

        try {
            const defaultApp = Gio.Application.getDefault();

            if (!(defaultApp instanceof Gtk.Application)) {
                throw new TypeError("Application not initialized");
            }

            this.registry.refresh();
            const result = await dispatch(method, params, { app: defaultApp, registry: this.registry });
            connection.write({ id, result });
        } catch (dispatchError) {
            connection.write({ id, error: toResponseError(dispatchError) });
        }
    }

    private async handleRequest(request: Request): Promise<void> {
        try {
            await this.respondToRequest(request);
        } catch (requestError) {
            error("Error handling request:", requestError);
        }
    }

    async connect(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.pendingConnectReject = reject;

            this.attemptConnect({
                onSuccess: () => {
                    this.pendingConnectReject = null;
                    resolve();
                },
                onError: (connectError) => {
                    this.pendingConnectReject = null;
                    reject(connectError);
                },
            });
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
}

export { McpClient };
