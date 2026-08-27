import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import {
    DEFAULT_SOCKET_PATH,
    isConnectionClosedError,
    type JSONRPCRequest,
    ProtocolConnection,
    type Result,
} from "@gtkx/mcp/internal";
import { error, errorMessage, info, normalizeError } from "@gtkx/utils";
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

        if (isConnectionClosedError(socketError) || (code !== undefined && DISCONNECT_ERROR_CODES.has(code))) {
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

        connection.fallbackRequestHandler = (request) => this.handleRequest(request);
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

    private handleRequest(request: JSONRPCRequest): Promise<Result> {
        const defaultApp = Gio.Application.getDefault();

        if (!(defaultApp instanceof Gtk.Application)) {
            throw new TypeError("Application not initialized");
        }

        this.registry.refresh();

        return dispatch(request.method, request.params, { app: defaultApp, registry: this.registry });
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

        if (this.socket) {
            void Promise.allSettled([this.connection?.send("app.unregister")]);
            this.socket.destroy();
            this.socket = null;
        }

        this.connection = null;
        this.hasConnected = false;
    }
}

export { McpClient };
