import * as net from "node:net";
import { getNativeInterface } from "@gtkx/ffi";
import * as Gio from "@gtkx/ffi/gio";
import { Value } from "@gtkx/ffi/gobject";
import * as Gtk from "@gtkx/ffi/gtk";
import {
    DEFAULT_SOCKET_PATH,
    type IpcMethod,
    type IpcRequest,
    IpcRequestSchema,
    type IpcResponse,
    IpcResponseSchema,
    McpError,
    McpErrorCode,
    methodNotFoundError,
    type SerializedWidget,
    widgetNotFoundError,
} from "@gtkx/mcp";

const widgetIdMap = new WeakMap<Gtk.Widget, string>();
let nextWidgetId = 0;

const getWidgetId = (widget: Gtk.Widget): string => {
    let id = widgetIdMap.get(widget);
    if (!id) {
        id = String(nextWidgetId++);
        widgetIdMap.set(widget, id);
    }
    return id;
};

type TestingModule = typeof import("@gtkx/testing");

let testingModule: TestingModule | null = null;
let testingLoadError: Error | null = null;

const loadTestingModule = async (): Promise<TestingModule> => {
    if (testingModule) return testingModule;
    if (testingLoadError) throw testingLoadError;

    try {
        testingModule = await import("@gtkx/testing");
        return testingModule;
    } catch (cause) {
        testingLoadError = new Error(
            "@gtkx/testing is not installed. Install it to enable MCP widget interactions: pnpm add -D @gtkx/testing",
            { cause },
        );
        throw testingLoadError;
    }
};

type McpClientOptions = {
    socketPath?: string;
    appId: string;
};

type PendingRequest = {
    resolve: (result: unknown) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
};

const RECONNECT_DELAY_MS = 2000;
const REQUEST_TIMEOUT_MS = 30000;

const formatRole = (role: Gtk.AccessibleRole | undefined): string => {
    if (role === undefined) return "UNKNOWN";
    return Gtk.AccessibleRole[role] ?? String(role);
};

const getWidgetText = (widget: Gtk.Widget): string | null => {
    if ("getLabel" in widget && typeof widget.getLabel === "function") {
        return widget.getLabel() ?? null;
    }

    if ("getText" in widget && typeof widget.getText === "function") {
        return widget.getText() ?? null;
    }

    if ("getTitle" in widget && typeof widget.getTitle === "function") {
        return widget.getTitle() ?? null;
    }

    return getNativeInterface(widget, Gtk.Editable)?.getText() ?? null;
};

const serializeWidget = (widget: Gtk.Widget): SerializedWidget => {
    const children: SerializedWidget[] = [];
    let child = widget.getFirstChild();
    while (child) {
        children.push(serializeWidget(child));
        child = child.getNextSibling();
    }

    const text = getWidgetText(widget);

    return {
        id: getWidgetId(widget),
        type: widget.constructor.name,
        role: formatRole(widget.getAccessibleRole()),
        name: widget.getName() || null,
        label: text,
        text,
        sensitive: widget.getSensitive(),
        visible: widget.getVisible(),
        cssClasses: widget.getCssClasses() ?? [],
        children,
    };
};

const widgetRegistry = new Map<string, Gtk.Widget>();

const registerWidgets = (widget: Gtk.Widget): void => {
    const idStr = getWidgetId(widget);
    widgetRegistry.set(idStr, widget);
    let child = widget.getFirstChild();
    while (child) {
        registerWidgets(child);
        child = child.getNextSibling();
    }
};

const getWidgetById = (id: string): Gtk.Widget | undefined => {
    return widgetRegistry.get(id);
};

const refreshWidgetRegistry = (): void => {
    widgetRegistry.clear();
    const windows = Gtk.Window.listToplevels();
    for (const window of windows) {
        registerWidgets(window);
    }
};

class McpClient {
    private socket: net.Socket | null = null;
    private buffer = "";
    private socketPath: string;
    private appId: string;
    private reconnectTimer: NodeJS.Timeout | null = null;
    private hasConnected = false;
    private isStopping = false;
    private pendingRequests = new Map<string, PendingRequest>();

    constructor(options: McpClientOptions) {
        this.socketPath = options.socketPath ?? DEFAULT_SOCKET_PATH;
        this.appId = options.appId;
    }

    async connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.attemptConnect(resolve, reject);
        });
    }

    private attemptConnect(onSuccess?: () => void, onError?: (error: Error) => void): void {
        let settled = false;

        const settle = <T extends unknown[]>(callback: ((...args: T) => void) | undefined, ...args: T) => {
            if (settled) return;
            settled = true;
            callback?.(...args);
        };

        this.socket = net.createConnection(this.socketPath, () => {
            console.log(`[gtkx] Connected to MCP server at ${this.socketPath}`);
            this.hasConnected = true;
            this.register()
                .then(() => {
                    console.log("[gtkx] Registered with MCP server");
                    settle(onSuccess);
                })
                .catch((error) => {
                    console.error("[gtkx] Failed to register with MCP server:", error.message);
                    settle(onError, error instanceof Error ? error : new Error(String(error)));
                });
        });

        this.socket.on("data", (data: Buffer) => this.handleData(data));

        this.socket.on("close", () => {
            if (this.hasConnected) {
                console.log("[gtkx] Disconnected from MCP server");
                this.hasConnected = false;
            }
            this.socket = null;
            this.rejectPendingRequests(new Error("Connection closed"));
            this.scheduleReconnect();
        });

        this.socket.on("error", (error) => {
            const code = (error as NodeJS.ErrnoException).code;
            const isDisconnectError =
                code === "ENOENT" || code === "ECONNREFUSED" || code === "EPIPE" || code === "ECONNRESET";
            if (isDisconnectError) {
                this.scheduleReconnect();
            } else {
                console.error("[gtkx] Socket error:", error.message);
            }
            settle(onError, error);
        });
    }

    private scheduleReconnect(): void {
        if (this.reconnectTimer || this.isStopping) return;
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.attemptConnect();
        }, RECONNECT_DELAY_MS);
    }

    disconnect(): void {
        this.isStopping = true;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        this.rejectPendingRequests(new Error("Client disconnected"));
        if (this.socket) {
            this.send({ id: crypto.randomUUID(), method: "app.unregister" });
            this.socket.destroy();
            this.socket = null;
        }
        this.hasConnected = false;
    }

    private rejectPendingRequests(error: Error): void {
        for (const pending of this.pendingRequests.values()) {
            clearTimeout(pending.timeout);
            pending.reject(error);
        }
        this.pendingRequests.clear();
    }

    private async register(): Promise<void> {
        await this.sendRequest("app.register", {
            appId: this.appId,
            pid: process.pid,
        });
    }

    private send(message: IpcRequest | IpcResponse): void {
        if (!this.socket || !this.socket.writable) return;
        this.socket.write(`${JSON.stringify(message)}\n`);
    }

    private sendRequest(method: IpcMethod, params?: unknown): Promise<unknown> {
        return new Promise((resolve, reject) => {
            if (!this.socket || !this.socket.writable) {
                reject(new Error("Socket not connected"));
                return;
            }

            const id = crypto.randomUUID();
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(id);
                reject(new Error(`Request timed out: ${method}`));
            }, REQUEST_TIMEOUT_MS);

            this.pendingRequests.set(id, { resolve, reject, timeout });
            this.send({ id, method, params });
        });
    }

    private handleData(data: Buffer): void {
        this.buffer += data.toString();

        let newlineIndex = this.buffer.indexOf("\n");
        while (newlineIndex !== -1) {
            const line = this.buffer.slice(0, newlineIndex);
            this.buffer = this.buffer.slice(newlineIndex + 1);

            if (line.trim()) {
                this.processMessage(line);
            }
            newlineIndex = this.buffer.indexOf("\n");
        }
    }

    private processMessage(line: string): void {
        let parsed: unknown;
        try {
            parsed = JSON.parse(line);
        } catch {
            console.warn("[gtkx] Received invalid JSON from MCP server");
            return;
        }

        const responseResult = IpcResponseSchema.safeParse(parsed);
        if (responseResult.success) {
            const response = responseResult.data;
            const pending = this.pendingRequests.get(response.id);
            if (pending) {
                clearTimeout(pending.timeout);
                this.pendingRequests.delete(response.id);
                if (response.error) {
                    pending.reject(new Error(response.error.message));
                } else {
                    pending.resolve(response.result);
                }
                return;
            }
        }

        const requestResult = IpcRequestSchema.safeParse(parsed);
        if (!requestResult.success) {
            return;
        }

        this.handleRequest(requestResult.data).catch((error) => {
            console.error("[gtkx] Error handling request:", error);
        });
    }

    private async handleRequest(request: IpcRequest): Promise<void> {
        const { id, method, params } = request;

        try {
            const result = await this.executeMethod(method as IpcMethod, params);
            this.send({ id, result });
        } catch (error) {
            if (error instanceof McpError) {
                this.send({ id, error: error.toIpcError() });
            } else {
                const message = error instanceof Error ? error.message : String(error);
                this.send({
                    id,
                    error: {
                        code: McpErrorCode.INTERNAL_ERROR,
                        message,
                    },
                });
            }
        }
    }

    private async executeMethod(method: IpcMethod, params: unknown): Promise<unknown> {
        const app = Gio.Application.getDefault() as Gtk.Application | null;

        if (!app) {
            throw new Error("Application not initialized");
        }

        refreshWidgetRegistry();

        switch (method) {
            case "app.getWindows": {
                const windows = Gtk.Window.listToplevels();
                return {
                    windows: windows.map((w) => ({
                        id: getWidgetId(w),
                        title: (w as Gtk.Window).getTitle?.() ?? null,
                    })),
                };
            }

            case "widget.getTree": {
                const testing = await loadTestingModule();
                return { tree: testing.prettyWidget(app, { includeIds: true, highlight: false }) };
            }

            case "widget.query": {
                const testing = await loadTestingModule();
                const p = params as { queryType: string; value: string | number; options?: Record<string, unknown> };
                let widgets: Gtk.Widget[] = [];

                switch (p.queryType) {
                    case "role": {
                        const roleValue =
                            typeof p.value === "string"
                                ? (Gtk.AccessibleRole[p.value as keyof typeof Gtk.AccessibleRole] as Gtk.AccessibleRole)
                                : (p.value as Gtk.AccessibleRole);
                        widgets = await testing.findAllByRole(app, roleValue, p.options);
                        break;
                    }
                    case "text":
                        widgets = await testing.findAllByText(app, String(p.value), p.options);
                        break;
                    case "testId":
                        widgets = await testing.findAllByTestId(app, String(p.value), p.options);
                        break;
                    case "labelText":
                        widgets = await testing.findAllByLabelText(app, String(p.value), p.options);
                        break;
                    default:
                        throw new Error(`Unknown query type: ${p.queryType}`);
                }

                return { widgets: widgets.map((w) => serializeWidget(w)) };
            }

            case "widget.getProps": {
                const p = params as { widgetId: string };
                const widget = getWidgetById(p.widgetId);
                if (!widget) {
                    throw widgetNotFoundError(p.widgetId);
                }
                return serializeWidget(widget);
            }

            case "widget.click": {
                const testing = await loadTestingModule();
                const p = params as { widgetId: string };
                const widget = getWidgetById(p.widgetId);
                if (!widget) {
                    throw widgetNotFoundError(p.widgetId);
                }
                await testing.userEvent.click(widget);
                return { success: true };
            }

            case "widget.type": {
                const testing = await loadTestingModule();
                const p = params as { widgetId: string; text: string; clear?: boolean };
                const widget = getWidgetById(p.widgetId);
                if (!widget) {
                    throw widgetNotFoundError(p.widgetId);
                }
                if (p.clear) {
                    await testing.userEvent.clear(widget);
                }
                await testing.userEvent.type(widget, p.text);
                return { success: true };
            }

            case "widget.fireEvent": {
                const testing = await loadTestingModule();
                const p = params as {
                    widgetId: string;
                    signal: string;
                    args?: (unknown | { type: string; value: unknown })[];
                };
                const widget = getWidgetById(p.widgetId);
                if (!widget) {
                    throw widgetNotFoundError(p.widgetId);
                }
                const signalArgs = (p.args ?? []).map((arg) => {
                    const isTypedArg = typeof arg === "object" && arg !== null && "type" in arg && "value" in arg;
                    const argType = isTypedArg ? (arg as { type: string }).type : typeof arg;
                    const argValue = isTypedArg ? (arg as { value: unknown }).value : arg;

                    switch (argType) {
                        case "boolean":
                            return Value.newFromBoolean(argValue as boolean);
                        case "int":
                            return Value.newFromInt(argValue as number);
                        case "uint":
                            return Value.newFromUint(argValue as number);
                        case "int64":
                            return Value.newFromInt64(argValue as number);
                        case "uint64":
                            return Value.newFromUint64(argValue as number);
                        case "float":
                            return Value.newFromFloat(argValue as number);
                        case "double":
                        case "number":
                            return Value.newFromDouble(argValue as number);
                        case "string":
                            return Value.newFromString(argValue as string | null);
                        default:
                            throw new McpError(McpErrorCode.INVALID_REQUEST, `Unknown argument type: ${argType}`);
                    }
                });
                await testing.fireEvent(widget, p.signal, ...signalArgs);
                return { success: true };
            }

            case "widget.screenshot": {
                const testing = await loadTestingModule();
                const p = params as { windowId?: string };

                let targetWindow: Gtk.Window;

                if (p.windowId) {
                    const widget = getWidgetById(p.windowId);
                    if (!widget) {
                        throw widgetNotFoundError(p.windowId);
                    }
                    targetWindow = widget as Gtk.Window;
                } else {
                    const windows = app.getWindows();
                    if (windows.length === 0) {
                        throw new Error("No windows available for screenshot");
                    }
                    targetWindow = windows[0] as Gtk.Window;
                }

                const result = await testing.screenshot(targetWindow);
                return { data: result.data, mimeType: result.mimeType };
            }

            default:
                throw methodNotFoundError(method);
        }
    }
}

let globalClient: McpClient | null = null;

export const startMcpClient = async (appId: string): Promise<McpClient> => {
    if (globalClient) {
        return globalClient;
    }

    globalClient = new McpClient({ appId });

    await globalClient.connect().catch(() => {});

    return globalClient;
};

export const stopMcpClient = (): void => {
    if (globalClient) {
        globalClient.disconnect();
        globalClient = null;
    }
};
