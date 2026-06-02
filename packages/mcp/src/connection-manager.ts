import EventEmitter from "node:events";
import {
    appNotFoundError,
    connectionWriteFailedError,
    invalidRequestError,
    noAppConnectedError,
} from "./protocol/errors.js";
import { type AppInfo, type IpcRequest, type IpcResponse, RegisterParamsSchema } from "./protocol/types.js";
import { type AppConnection, type AppTransport, TransportClosedError } from "./transport.js";

type ConnectionManagerEventMap = {
    appRegistered: [AppInfo];
    appUnregistered: [string];
};

type RegisteredApp = {
    info: AppInfo;
    connection: AppConnection;
};

/**
 * Manages connections between the MCP server and GTKX applications.
 *
 * Handles app registration, request routing, and connection lifecycle. Wire
 * framing and pending-request correlation live on each connection's
 * {@link import("./transport.js").JsonStreamTransport}.
 */
export class ConnectionManager extends EventEmitter<ConnectionManagerEventMap> {
    private static readonly DEFAULT_WAIT_TIMEOUT = 10000;

    private readonly apps: Map<string, RegisteredApp> = new Map();
    private readonly connectionToApp: Map<string, string> = new Map();
    private readonly requestTimeout: number;

    constructor(
        private readonly transport: AppTransport,
        options: { requestTimeout?: number } = {},
    ) {
        super();
        this.requestTimeout = options.requestTimeout ?? 30000;

        this.transport.on("request", (connection, request) => {
            this.handleRequest(connection, request);
        });

        this.transport.on("disconnection", (connection) => {
            this.removeApp(connection);
        });
    }

    getApps(): AppInfo[] {
        return Array.from(this.apps.values()).map((app) => app.info);
    }

    hasConnectedApps(): boolean {
        return this.apps.size > 0;
    }

    getDefaultApp(): RegisteredApp | undefined {
        const first = this.apps.values().next();
        return first.done ? undefined : first.value;
    }

    /**
     * Waits for at least one app to connect and register.
     *
     * @param timeout - Maximum time to wait in milliseconds (default: 10000).
     * @returns Promise that resolves with the first registered app info.
     * @throws Error if timeout is reached before any app registers.
     */
    waitForApp(timeout: number = ConnectionManager.DEFAULT_WAIT_TIMEOUT): Promise<AppInfo> {
        const defaultApp = this.getDefaultApp();
        if (defaultApp) {
            return Promise.resolve(defaultApp.info);
        }

        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                this.off("appRegistered", onRegister);
                reject(
                    new Error(
                        `Timeout waiting for app registration after ${timeout}ms. ` +
                            "Make sure your GTKX app is running with 'gtkx dev'.",
                    ),
                );
            }, timeout);

            const onRegister = (appInfo: AppInfo) => {
                clearTimeout(timeoutId);
                this.off("appRegistered", onRegister);
                resolve(appInfo);
            };

            this.on("appRegistered", onRegister);
        });
    }

    async sendToApp<T>(applicationId: string | undefined, method: string, params?: unknown): Promise<T> {
        const app = applicationId ? this.apps.get(applicationId) : this.getDefaultApp();

        if (!app) {
            if (applicationId) {
                throw appNotFoundError(applicationId);
            }
            throw noAppConnectedError();
        }

        try {
            return await app.connection.transport.sendRequest<T>(method, params, this.requestTimeout);
        } catch (error) {
            if (error instanceof TransportClosedError) {
                this.removeApp(app.connection);
                throw connectionWriteFailedError(app.info.applicationId);
            }
            throw error;
        }
    }

    cleanup(): void {
        for (const app of this.apps.values()) {
            app.connection.transport.rejectPending(new Error("Connection manager shutting down"));
        }
    }

    private handleRequest(connection: AppConnection, request: IpcRequest): void {
        if (request.method === "app.register") {
            this.handleRegister(connection, request);
        } else if (request.method === "app.unregister") {
            this.handleUnregister(connection, request);
        }
    }

    private handleRegister(connection: AppConnection, request: IpcRequest): void {
        const parseResult = RegisterParamsSchema.safeParse(request.params);
        if (!parseResult.success) {
            this.transport.send(connection.id, {
                id: request.id,
                error: invalidRequestError(parseResult.error.message).toIpcError(),
            });
            return;
        }

        const params = parseResult.data;
        const appInfo: AppInfo = {
            applicationId: params.applicationId,
            pid: params.pid,
            windows: [],
        };

        this.apps.set(params.applicationId, { info: appInfo, connection });
        this.connectionToApp.set(connection.id, params.applicationId);

        this.acknowledge(connection, request);

        this.emit("appRegistered", appInfo);
    }

    private handleUnregister(connection: AppConnection, request: IpcRequest): void {
        this.removeApp(connection);
        this.acknowledge(connection, request);
    }

    private acknowledge(connection: AppConnection, request: IpcRequest): void {
        const response: IpcResponse = {
            id: request.id,
            result: { success: true },
        };
        this.transport.send(connection.id, response);
    }

    private removeApp(connection: AppConnection): void {
        const applicationId = this.connectionToApp.get(connection.id);
        if (!applicationId) return;
        this.apps.delete(applicationId);
        this.connectionToApp.delete(connection.id);
        this.emit("appUnregistered", applicationId);
    }
}
