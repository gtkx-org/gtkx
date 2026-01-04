import EventEmitter from "node:events";
import {
    appNotFoundError,
    invalidRequestError,
    ipcTimeoutError,
    McpError,
    type McpErrorCode,
    noAppConnectedError,
} from "./protocol/errors.js";
import { type AppInfo, type IpcRequest, type IpcResponse, RegisterParamsSchema } from "./protocol/types.js";
import type { AppConnection, SocketServer } from "./socket-server.js";

type ConnectionManagerEventMap = {
    appRegistered: [AppInfo];
    appUnregistered: [string];
};

interface PendingRequest {
    resolve: (result: unknown) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
}

interface RegisteredApp {
    info: AppInfo;
    connection: AppConnection;
}

/**
 * Manages connections between the MCP server and GTKX applications.
 *
 * Handles app registration, request routing, and connection lifecycle.
 */
export class ConnectionManager extends EventEmitter<ConnectionManagerEventMap> {
    private apps: Map<string, RegisteredApp> = new Map();
    private connectionToApp: Map<string, string> = new Map();
    private pendingRequests: Map<string, PendingRequest> = new Map();
    private requestTimeout: number;

    constructor(
        private socketServer: SocketServer,
        options: { requestTimeout?: number } = {},
    ) {
        super();
        this.requestTimeout = options.requestTimeout ?? 30000;

        this.socketServer.on("request", (connection, request) => {
            this.handleRequest(connection, request);
        });

        this.socketServer.on("response", (_connection, response) => {
            this.handleResponse(response);
        });

        this.socketServer.on("disconnection", (connection) => {
            this.handleDisconnection(connection);
        });
    }

    getApps(): AppInfo[] {
        return Array.from(this.apps.values()).map((app) => app.info);
    }

    getApp(appId: string): AppInfo | undefined {
        return this.apps.get(appId)?.info;
    }

    hasConnectedApps(): boolean {
        return this.apps.size > 0;
    }

    getDefaultApp(): RegisteredApp | undefined {
        const first = this.apps.values().next();
        return first.done ? undefined : first.value;
    }

    async sendToApp<T>(appId: string | undefined, method: string, params?: unknown): Promise<T> {
        const app = appId ? this.apps.get(appId) : this.getDefaultApp();

        if (!app) {
            if (appId) {
                throw appNotFoundError(appId);
            }
            throw noAppConnectedError();
        }

        const requestId = crypto.randomUUID();
        const request: IpcRequest = {
            id: requestId,
            method,
            params,
        };

        return new Promise<T>((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(requestId);
                reject(ipcTimeoutError(this.requestTimeout));
            }, this.requestTimeout);

            this.pendingRequests.set(requestId, {
                resolve: resolve as (result: unknown) => void,
                reject,
                timeout,
            });

            const sent = this.socketServer.send(app.connection.id, request);
            if (!sent) {
                clearTimeout(timeout);
                this.pendingRequests.delete(requestId);
                reject(appNotFoundError(app.info.appId));
                return;
            }
        });
    }

    cleanup(): void {
        for (const pending of this.pendingRequests.values()) {
            clearTimeout(pending.timeout);
            pending.reject(new Error("Connection manager shutting down"));
        }
        this.pendingRequests.clear();
    }

    private handleRequest(connection: AppConnection, request: IpcRequest): void {
        if (request.method === "app.register") {
            this.handleRegister(connection, request);
            return;
        }

        if (request.method === "app.unregister") {
            this.handleUnregister(connection, request);
            return;
        }
    }

    private handleResponse(response: IpcResponse): void {
        const pending = this.pendingRequests.get(response.id);
        if (!pending) {
            return;
        }

        clearTimeout(pending.timeout);
        this.pendingRequests.delete(response.id);

        if (response.error) {
            const err = response.error;
            pending.reject(new McpError(err.code as McpErrorCode, err.message, err.data));
        } else {
            pending.resolve(response.result);
        }
    }

    private handleRegister(connection: AppConnection, request: IpcRequest): void {
        const parseResult = RegisterParamsSchema.safeParse(request.params);
        if (!parseResult.success) {
            const response: IpcResponse = {
                id: request.id,
                error: invalidRequestError(parseResult.error.message).toIpcError(),
            };
            this.socketServer.send(connection.id, response);
            return;
        }

        const params = parseResult.data;
        const appInfo: AppInfo = {
            appId: params.appId,
            pid: params.pid,
            windows: [],
        };

        const registeredApp: RegisteredApp = {
            info: appInfo,
            connection,
        };

        this.apps.set(params.appId, registeredApp);
        this.connectionToApp.set(connection.id, params.appId);

        const response: IpcResponse = {
            id: request.id,
            result: { success: true },
        };
        this.socketServer.send(connection.id, response);

        this.emit("appRegistered", appInfo);
    }

    private handleUnregister(connection: AppConnection, request: IpcRequest): void {
        const appId = this.connectionToApp.get(connection.id);
        if (appId) {
            this.apps.delete(appId);
            this.connectionToApp.delete(connection.id);
            this.emit("appUnregistered", appId);
        }

        const response: IpcResponse = {
            id: request.id,
            result: { success: true },
        };
        this.socketServer.send(connection.id, response);
    }

    private handleDisconnection(connection: AppConnection): void {
        const appId = this.connectionToApp.get(connection.id);
        if (appId) {
            this.apps.delete(appId);
            this.connectionToApp.delete(connection.id);
            this.emit("appUnregistered", appId);
        }
    }
}
