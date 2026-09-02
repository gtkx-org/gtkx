import { type JSONRPCRequest, McpError, type Result } from "@modelcontextprotocol/sdk/types.js";
import type { AppConnections, ConnectionEvent, ProtocolConnection, RequestParams } from "./transport.js";
import {
    appNotFoundError,
    CONNECTION_CLOSED_CODE,
    connectionWriteFailedError,
    invalidRequestError,
    methodNotFoundError,
    noAppConnectedError,
    type ProtocolError,
    protocolErrorFrom,
    REQUEST_TIMEOUT_CODE,
    requestTimeoutError,
} from "./protocol/errors.js";
import { type AppInfo, RegisterParamsSchema } from "./protocol/schemas.js";

type AppRegisteredEvent = CustomEvent<AppInfo>;
type AppUnregisteredEvent = CustomEvent<string>;
type PendingAppWait = { reject: (error: Error) => void };

type RegisteredApp = {
    info: AppInfo;
    connection: ProtocolConnection;
};

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

const routerStoppedError = (): Error => new Error("GTKX MCP server stopped while waiting for an application");

const appWaitTimeoutError = (timeout: number): Error =>
    new Error(
        `Timeout waiting for app registration after ${String(timeout)}ms. ` +
        "Make sure your GTKX app is running with 'gtkx dev'.",
    );

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

    private pendingAppWaits: Set<PendingAppWait> = new Set();

    private isDisposed = false;

    constructor(connections: AppConnections, options: { requestTimeout?: number } = {}) {
        super();
        this.connections = connections;
        this.requestTimeout = options.requestTimeout ?? DEFAULT_REQUEST_TIMEOUT_MS;
        this.connections.onRequest = (connection, request) => this.handleRequest(connection, request);

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

    private handleRequest(connection: ProtocolConnection, request: JSONRPCRequest): Promise<Result> {
        if (this.isDisposed) {
            return Promise.reject(routerStoppedError());
        }

        if (request.method === "app.register") {
            return Promise.resolve(this.handleRegister(connection, request));
        }

        if (request.method === "app.unregister") {
            this.removeApp(connection);

            return Promise.resolve({ success: true });
        }

        return Promise.reject(methodNotFoundError(request.method));
    }

    private handleRegister(connection: ProtocolConnection, request: JSONRPCRequest): Result {
        const parseResult = RegisterParamsSchema.safeParse(request.params);

        if (!parseResult.success) {
            throw invalidRequestError(parseResult.error.message);
        }

        const params = parseResult.data;

        const appInfo: AppInfo = {
            applicationId: params.applicationId,
            pid: params.pid,
            ...(params.projectRoot !== undefined && { projectRoot: params.projectRoot }),
        };

        this.apps.set(params.applicationId, { info: appInfo, connection });
        this.connectionToApp.set(connection.id, params.applicationId);
        this.dispatchEvent(appRegisteredEvent(appInfo));

        return { success: true };
    }

    private toAppError(app: RegisteredApp, error: McpError): ProtocolError {
        if (error.code === CONNECTION_CLOSED_CODE) {
            this.removeApp(app.connection);

            return connectionWriteFailedError(app.info.applicationId);
        }

        if (error.code === REQUEST_TIMEOUT_CODE) {
            return requestTimeoutError(this.requestTimeout);
        }

        return protocolErrorFrom(error);
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

    private async waitForRegistration(applicationId: string | undefined, timeout: number): Promise<AppInfo> {
        const controller = new AbortController();
        const { promise, reject, resolve } = Promise.withResolvers<AppInfo>();
        const rejectWait = (error: Error): void => {
            controller.abort();
            reject(error);
        };
        const pendingWait: PendingAppWait = { reject: rejectWait };
        const timeoutId = setTimeout(() => {
            rejectWait(appWaitTimeoutError(timeout));
        }, timeout);

        this.addEventListener(
            "appRegistered",
            (event) => {
                const info = (event as AppRegisteredEvent).detail;

                if (applicationId === undefined || info.applicationId === applicationId) {
                    resolve(info);
                }
            },
            { signal: controller.signal },
        );
        this.pendingAppWaits.add(pendingWait);

        try {
            return await promise;
        } finally {
            clearTimeout(timeoutId);
            controller.abort();
            this.pendingAppWaits.delete(pendingWait);
        }
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

    dispose(): void {
        if (this.isDisposed) {
            return;
        }

        this.isDisposed = true;
        const error = routerStoppedError();

        for (const pendingWait of this.pendingAppWaits) {
            pendingWait.reject(error);
        }
    }

    waitForApp(applicationId?: string, timeout: number = AppRouter.defaultWaitTimeout): Promise<AppInfo> {
        if (this.isDisposed) {
            return Promise.reject(routerStoppedError());
        }

        const app = applicationId === undefined ? this.getDefaultApp() : this.apps.get(applicationId);

        if (app) {
            return Promise.resolve(app.info);
        }

        return this.waitForRegistration(applicationId, timeout);
    }

    async sendToApp<T>(
        applicationId: string | undefined,
        method: string,
        params?: RequestParams,
        waitTimeout?: number,
    ): Promise<T> {
        await this.waitForApp(applicationId, waitTimeout);
        const app = this.resolveTargetApp(applicationId);

        try {
            return await app.connection.send<T>(method, params, this.requestTimeout);
        } catch (error) {
            if (error instanceof McpError) {
                throw this.toAppError(app, error);
            }

            throw error;
        }
    }
}

export { AppRouter, type AppRegisteredEvent, type AppUnregisteredEvent };
