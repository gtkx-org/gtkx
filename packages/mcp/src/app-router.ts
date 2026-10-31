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
import { type AppInfo, RECONNECT_DELAY_MS, RegisterParamsSchema } from "./protocol/schemas.js";

type AppRegisteredEvent = CustomEvent<AppInfo>;
type AppUnregisteredEvent = CustomEvent<string>;
type PendingAppWait = { reject: (error: Error) => void };
type ProjectMatcher = (projectRoot: string) => boolean;
type AppMatcher = (info: AppInfo) => boolean;

type RegisteredApp = {
    info: AppInfo;
    connection: ProtocolConnection;
};

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
const DEFAULT_APP_TIMEOUT_MS = 10_000;
const STORYBOOK_APPLICATION_ID_SUFFIX = ".Storybook";

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
    private apps: Map<string, RegisteredApp> = new Map();

    private connectionToApp: Map<string, string> = new Map();

    private connections: AppConnections;

    private pendingAppWaits: Set<PendingAppWait> = new Set();

    private isDisposed = false;

    private isServerProject: ProjectMatcher;

    private listeningSince: number | undefined;

    private projectAppLeftAt: number | undefined;

    constructor(connections: AppConnections, isServerProject: ProjectMatcher) {
        super();
        this.connections = connections;
        this.isServerProject = isServerProject;
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
        this.removeApp(connection);
        this.apps.set(params.applicationId, { info: params, connection });
        this.connectionToApp.set(connection.id, params.applicationId);
        this.dispatchEvent(appRegisteredEvent(params));

        return { success: true };
    }

    private toAppError(app: RegisteredApp, error: McpError): ProtocolError {
        if (error.code === CONNECTION_CLOSED_CODE) {
            this.removeApp(app.connection);

            return connectionWriteFailedError(app.info.applicationId);
        }

        if (error.code === REQUEST_TIMEOUT_CODE) {
            return requestTimeoutError(DEFAULT_REQUEST_TIMEOUT_MS);
        }

        return protocolErrorFrom(error);
    }

    private removeApp(connection: ProtocolConnection): void {
        const applicationId = this.connectionToApp.get(connection.id);
        this.connectionToApp.delete(connection.id);

        if (applicationId === undefined) {
            return;
        }

        const app = this.apps.get(applicationId);

        if (app?.connection !== connection) {
            return;
        }

        this.apps.delete(applicationId);

        if (this.isProjectApp(app.info)) {
            this.projectAppLeftAt = Date.now();
        }

        this.dispatchEvent(appUnregisteredEvent(applicationId));
    }

    private isFromServerProject(info: AppInfo): boolean {
        return info.projectRoot !== undefined && this.isServerProject(info.projectRoot);
    }

    private isProjectApp(info: AppInfo): boolean {
        return this.isFromServerProject(info) && !info.applicationId.endsWith(STORYBOOK_APPLICATION_ID_SUFFIX);
    }

    private projectAppWait(timeout: number): number {
        const now = Date.now();
        const waits = [0];

        if (this.listeningSince !== undefined && now - this.listeningSince < RECONNECT_DELAY_MS) {
            waits.push(this.listeningSince + 2 * RECONNECT_DELAY_MS - now);
        }

        if (this.projectAppLeftAt !== undefined && now - this.projectAppLeftAt < timeout) {
            waits.push(timeout);
        }

        return Math.min(timeout, Math.max(...waits));
    }

    private async waitForDefaultApp(timeout: number): Promise<AppInfo> {
        const startedAt = Date.now();
        const projectApp = this.apps.values().find(({ info }) => this.isProjectApp(info));

        if (projectApp !== undefined) {
            return projectApp.info;
        }

        const projectWait = this.projectAppWait(timeout);

        if (projectWait > 0) {
            const info = await this.waitForRegistration((candidate) => this.isProjectApp(candidate), projectWait);

            if (info !== undefined) {
                return info;
            }
        }

        const app = this.getDefaultApp();

        if (app !== undefined) {
            return app.info;
        }

        const remaining = Math.max(0, timeout - (Date.now() - startedAt));
        const info = await this.waitForRegistration(() => true, remaining);

        if (info === undefined) {
            throw appWaitTimeoutError(timeout);
        }

        return info;
    }

    private async requireRegistration(matches: AppMatcher, timeout: number): Promise<AppInfo> {
        const info = await this.waitForRegistration(matches, timeout);

        if (info === undefined) {
            throw appWaitTimeoutError(timeout);
        }

        return info;
    }

    private async waitForRegistration(matches: AppMatcher, timeout: number): Promise<AppInfo | undefined> {
        const controller = new AbortController();
        const { promise, reject, resolve } = Promise.withResolvers<AppInfo | undefined>();
        const rejectWait = (error: Error): void => {
            controller.abort();
            reject(error);
        };
        const pendingWait: PendingAppWait = { reject: rejectWait };
        const timeoutId = setTimeout(() => {
            resolve(undefined);
        }, timeout);

        this.addEventListener(
            "appRegistered",
            (event) => {
                const info = (event as AppRegisteredEvent).detail;

                if (matches(info)) {
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
        return this.apps
            .values()
            .map((app) => app.info)
            .toArray();
    }

    getDefaultApp(): RegisteredApp | undefined {
        const apps = [...this.apps.values()];
        const fromServerProject = apps.filter(({ info }) => this.isFromServerProject(info));

        return fromServerProject.find(({ info }) => this.isProjectApp(info)) ?? fromServerProject[0] ?? apps[0];
    }

    getProjectRoot(): string | undefined {
        return this.getDefaultApp()?.info.projectRoot;
    }

    /** Records that the app socket is accepting connections, which starts the apps' reconnect window. */
    markListening(): void {
        this.listeningSince = Date.now();
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

    /** Resolves with the first app registered, waiting up to `timeout` when none is. */
    waitForAnyApp(timeout: number = DEFAULT_APP_TIMEOUT_MS): Promise<AppInfo> {
        if (this.isDisposed) {
            return Promise.reject(routerStoppedError());
        }

        const app = this.apps.values().next();

        return app.done === true ? this.requireRegistration(() => true, timeout) : Promise.resolve(app.value.info);
    }

    /**
     * Resolves with the app a request is routed to, waiting up to `timeout` for it to register. Without an
     * application ID this is the project's app. While it is expected back the wait holds out for it instead
     * of settling for its Storybook explorer or another project's app: for `timeout` after it disconnects,
     * and, for a request in the first client reconnect interval after the socket starts listening, until
     * two reconnect intervals after it started.
     */
    waitForApp(applicationId?: string, timeout: number = DEFAULT_APP_TIMEOUT_MS): Promise<AppInfo> {
        if (this.isDisposed) {
            return Promise.reject(routerStoppedError());
        }

        if (applicationId === undefined) {
            return this.waitForDefaultApp(timeout);
        }

        const app = this.apps.get(applicationId);

        if (app) {
            return Promise.resolve(app.info);
        }

        return this.requireRegistration((info) => info.applicationId === applicationId, timeout);
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
            return await app.connection.send<T>(method, params, DEFAULT_REQUEST_TIMEOUT_MS);
        } catch (error) {
            if (error instanceof McpError) {
                throw this.toAppError(app, error);
            }

            throw error;
        }
    }
}

export { AppRouter, type AppRegisteredEvent, type AppUnregisteredEvent };
