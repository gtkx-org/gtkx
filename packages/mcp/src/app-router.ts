import EventEmitter from "node:events";
import {
    appNotFoundError,
    connectionWriteFailedError,
    invalidRequestError,
    methodNotFoundError,
    noAppConnectedError,
} from "./protocol/errors.js";
import { type AppInfo, RegisterParamsSchema, type Request, type Response } from "./protocol/schemas.js";
import { type AppConnections, ConnectionClosedError, type ProtocolConnection } from "./transport.js";

type AppRouterEventMap = {
    appRegistered: [AppInfo];
    appUnregistered: [string];
};

type RegisteredApp = {
    info: AppInfo;
    connection: ProtocolConnection;
};

const DEFAULT_REQUEST_TIMEOUT_MS = 30000;

export class AppRouter extends EventEmitter<AppRouterEventMap> {
    private static DEFAULT_WAIT_TIMEOUT = 10000;

    private apps: Map<string, RegisteredApp> = new Map();
    private connectionToApp: Map<string, string> = new Map();
    private requestTimeout: number;
    private connections: AppConnections;

    constructor(connections: AppConnections, options: { requestTimeout?: number } = {}) {
        super();
        this.connections = connections;
        this.requestTimeout = options.requestTimeout ?? DEFAULT_REQUEST_TIMEOUT_MS;

        this.connections.on("request", (connection, request) => {
            this.handleRequest(connection, request);
        });

        this.connections.on("disconnection", (connection) => {
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

    getProjectRoot(): string | undefined {
        return this.getDefaultApp()?.info.projectRoot;
    }

    waitForApp(timeout: number = AppRouter.DEFAULT_WAIT_TIMEOUT): Promise<AppInfo> {
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
            return await app.connection.send<T>(method, params, this.requestTimeout);
        } catch (error) {
            if (error instanceof ConnectionClosedError) {
                this.removeApp(app.connection);
                throw connectionWriteFailedError(app.info.applicationId);
            }
            throw error;
        }
    }

    private handleRequest(connection: ProtocolConnection, request: Request): void {
        if (request.method === "app.register") {
            this.handleRegister(connection, request);
        } else if (request.method === "app.unregister") {
            this.handleUnregister(connection, request);
        } else {
            this.connections.send(connection.id, {
                id: request.id,
                error: methodNotFoundError(request.method).toErrorObject(),
            });
        }
    }

    private handleRegister(connection: ProtocolConnection, request: Request): void {
        const parseResult = RegisterParamsSchema.safeParse(request.params);
        if (!parseResult.success) {
            this.connections.send(connection.id, {
                id: request.id,
                error: invalidRequestError(parseResult.error.message).toErrorObject(),
            });
            return;
        }

        const params = parseResult.data;
        const appInfo: AppInfo = {
            applicationId: params.applicationId,
            pid: params.pid,
            ...(params.projectRoot === undefined ? {} : { projectRoot: params.projectRoot }),
        };

        this.apps.set(params.applicationId, { info: appInfo, connection });
        this.connectionToApp.set(connection.id, params.applicationId);

        this.acknowledge(connection, request);

        this.emit("appRegistered", appInfo);
    }

    private handleUnregister(connection: ProtocolConnection, request: Request): void {
        this.removeApp(connection);
        this.acknowledge(connection, request);
    }

    private acknowledge(connection: ProtocolConnection, request: Request): void {
        const response: Response = {
            id: request.id,
            result: { success: true },
        };
        this.connections.send(connection.id, response);
    }

    private removeApp(connection: ProtocolConnection): void {
        const applicationId = this.connectionToApp.get(connection.id);
        this.connectionToApp.delete(connection.id);
        if (applicationId === undefined) return;
        if (this.apps.get(applicationId)?.connection !== connection) return;
        this.apps.delete(applicationId);
        this.emit("appUnregistered", applicationId);
    }
}
