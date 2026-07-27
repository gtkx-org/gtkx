import {
    appNotFoundError,
    connectionWriteFailedError,
    invalidRequestError,
    methodNotFoundError,
    noAppConnectedError,
    type ProtocolError,
} from "./protocol/errors.js";
import { type AppInfo, RegisterParamsSchema, type Request, type Response } from "./protocol/schemas.js";
import {
    type AppConnections,
    ConnectionClosedError,
    type ConnectionEvent,
    type ConnectionRequestEvent,
    type ProtocolConnection,
} from "./transport.js";

type AppRegisteredEvent = CustomEvent<AppInfo>;
type AppUnregisteredEvent = CustomEvent<string>;

type RegisteredApp = {
    info: AppInfo;
    connection: ProtocolConnection;
};

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

function appRegisteredEvent(info: AppInfo): AppRegisteredEvent {
    return new CustomEvent("appRegistered", { detail: info });
}

function appUnregisteredEvent(applicationId: string): AppUnregisteredEvent {
    return new CustomEvent("appUnregistered", { detail: applicationId });
}

class AppRouter extends EventTarget {
    private static defaultWaitTimeout = 10_000;

    private apps: Map<string, RegisteredApp> = new Map();

    private connectionToApp: Map<string, string> = new Map();

    private requestTimeout: number;

    private connections: AppConnections;

    constructor(connections: AppConnections, options: { requestTimeout?: number } = {}) {
        super();
        this.connections = connections;
        this.requestTimeout = options.requestTimeout ?? DEFAULT_REQUEST_TIMEOUT_MS;

        this.connections.addEventListener("request", (event) => {
            const { connection, request } = (event as ConnectionRequestEvent).detail;
            this.handleRequest(connection, request);
        });

        this.connections.addEventListener("disconnection", (event) => {
            this.removeApp((event as ConnectionEvent).detail);
        });
    }

    private resolveTargetApp(applicationId: string | undefined): RegisteredApp {
        const app = applicationId ? this.apps.get(applicationId) : this.getDefaultApp();

        if (app) {
            return app;
        }

        if (applicationId) {
            throw appNotFoundError(applicationId);
        }

        throw noAppConnectedError();
    }

    private handleRequest(connection: ProtocolConnection, request: Request): void {
        if (request.method === "app.register") {
            this.handleRegister(connection, request);
        } else if (request.method === "app.unregister") {
            this.handleUnregister(connection, request);
        } else {
            this.sendError(connection, request, methodNotFoundError(request.method));
        }
    }

    private handleRegister(connection: ProtocolConnection, request: Request): void {
        const parseResult = RegisterParamsSchema.safeParse(request.params);

        if (!parseResult.success) {
            this.sendError(connection, request, invalidRequestError(parseResult.error.message));

            return;
        }

        const params = parseResult.data;

        const appInfo: AppInfo = {
            applicationId: params.applicationId,
            pid: params.pid,
            ...(params.projectRoot !== undefined && { projectRoot: params.projectRoot }),
        };

        this.apps.set(params.applicationId, { info: appInfo, connection });
        this.connectionToApp.set(connection.id, params.applicationId);
        this.acknowledge(connection, request);
        this.dispatchEvent(appRegisteredEvent(appInfo));
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

    private sendError(connection: ProtocolConnection, request: Request, error: ProtocolError): void {
        this.connections.send(connection.id, {
            id: request.id,
            error: error.toErrorObject(),
        });
    }

    private removeApp(connection: ProtocolConnection): void {
        const applicationId = this.connectionToApp.get(connection.id);
        this.connectionToApp.delete(connection.id);

        if (applicationId === undefined) {
            return;
        }

        if (this.apps.get(applicationId)?.connection !== connection) {
            return;
        }

        this.apps.delete(applicationId);
        this.dispatchEvent(appUnregisteredEvent(applicationId));
    }

    getApps(): AppInfo[] {
        return this.apps.values().map((app) => app.info).toArray();
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

    waitForApp(timeout: number = AppRouter.defaultWaitTimeout): Promise<AppInfo> {
        const defaultApp = this.getDefaultApp();

        if (defaultApp) {
            return Promise.resolve(defaultApp.info);
        }

        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                this.removeEventListener("appRegistered", onRegister);

                reject(
                    new Error(
                        `Timeout waiting for app registration after ${String(timeout)}ms. ` +
                        "Make sure your GTKX app is running with 'gtkx dev'.",
                    ),
                );
            }, timeout);

            const onRegister = (event: Event): void => {
                clearTimeout(timeoutId);
                this.removeEventListener("appRegistered", onRegister);
                resolve((event as AppRegisteredEvent).detail);
            };

            this.addEventListener("appRegistered", onRegister);
        });
    }

    async sendToApp<T>(applicationId: string | undefined, method: string, params?: unknown): Promise<T> {
        const app = this.resolveTargetApp(applicationId);

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
}

export { AppRouter, appRegisteredEvent, appUnregisteredEvent, type AppRegisteredEvent, type AppUnregisteredEvent };
