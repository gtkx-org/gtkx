import * as net from "node:net";
import { getNativeObject, getObjectId } from "@gtkx/ffi";
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
import { getApplication } from "@gtkx/react";

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

interface PendingRequest {
    resolve: (result: unknown) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
}

const RECONNECT_DELAY_MS = 2000;
const REQUEST_TIMEOUT_MS = 5000;

const formatRole = (role: Gtk.AccessibleRole | undefined): string => {
    if (role === undefined) return "UNKNOWN";
    return Gtk.AccessibleRole[role] ?? String(role);
};

const getWidgetText = (widget: Gtk.Widget): string | null => {
    const role = widget.getAccessibleRole();
    if (role === undefined) return null;

    switch (role) {
        case Gtk.AccessibleRole.BUTTON:
        case Gtk.AccessibleRole.LINK:
        case Gtk.AccessibleRole.TAB:
            return (widget as Gtk.Button).getLabel?.() ?? (widget as Gtk.MenuButton).getLabel?.() ?? null;
        case Gtk.AccessibleRole.TOGGLE_BUTTON:
            return (widget as Gtk.ToggleButton).getLabel?.() ?? null;
        case Gtk.AccessibleRole.CHECKBOX:
        case Gtk.AccessibleRole.RADIO:
            return (widget as Gtk.CheckButton).getLabel?.() ?? null;
        case Gtk.AccessibleRole.LABEL:
            return (widget as Gtk.Label).getLabel?.() ?? (widget as Gtk.Inscription).getText?.() ?? null;
        case Gtk.AccessibleRole.TEXT_BOX:
        case Gtk.AccessibleRole.SEARCH_BOX:
        case Gtk.AccessibleRole.SPIN_BUTTON:
            return getNativeObject(widget.id, Gtk.Editable).getText() ?? null;
        case Gtk.AccessibleRole.GROUP:
            return (widget as Gtk.Frame).getLabel?.() ?? null;
        case Gtk.AccessibleRole.WINDOW:
        case Gtk.AccessibleRole.DIALOG:
        case Gtk.AccessibleRole.ALERT_DIALOG:
            return (widget as Gtk.Window).getTitle() ?? null;
        default:
            return null;
    }
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
        id: String(getObjectId(widget.id)),
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
    const idStr = String(getObjectId(widget.id));
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
    const app = getApplication();
    if (!app) return;

    const windows = app.getWindows();
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
        return new Promise((resolve) => {
            this.attemptConnect(resolve);
        });
    }

    private attemptConnect(onFirstConnect?: () => void): void {
        this.socket = net.createConnection(this.socketPath, () => {
            console.log(`[gtkx] Connected to MCP server at ${this.socketPath}`);
            this.hasConnected = true;
            this.register()
                .then(() => {
                    console.log("[gtkx] Registered with MCP server");
                    onFirstConnect?.();
                })
                .catch((error) => {
                    console.error("[gtkx] Failed to register with MCP server:", error.message);
                    onFirstConnect?.();
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
            onFirstConnect?.();
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
        const app = getApplication();
        if (!app) {
            throw new Error("Application not initialized");
        }

        refreshWidgetRegistry();

        switch (method) {
            case "widget.getTree": {
                const windows = app.getWindows();
                return { windows: windows.map((w) => serializeWidget(w)) };
            }

            case "widget.query": {
                const testing = await loadTestingModule();
                const p = params as { queryType: string; value: string | number; options?: Record<string, unknown> };
                let widgets: Gtk.Widget[] = [];

                switch (p.queryType) {
                    case "role":
                        widgets = await testing.findAllByRole(app, p.value as Gtk.AccessibleRole, p.options);
                        break;
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
                const p = params as { widgetId: string; signal: string; args?: { type: unknown; value: unknown }[] };
                const widget = getWidgetById(p.widgetId);
                if (!widget) {
                    throw widgetNotFoundError(p.widgetId);
                }
                type FireEventArgs = Parameters<TestingModule["fireEvent"]>;
                const signalArgs = (p.args ?? []) as FireEventArgs[2][];
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

export const startMcpClient = (appId: string): McpClient => {
    if (globalClient) {
        return globalClient;
    }

    globalClient = new McpClient({ appId });
    globalClient.connect().catch((error) => {
        console.error("[gtkx] Failed to connect:", error);
    });

    return globalClient;
};

export const stopMcpClient = (): void => {
    if (globalClient) {
        globalClient.disconnect();
        globalClient = null;
    }
};
