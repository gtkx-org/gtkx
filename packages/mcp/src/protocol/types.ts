import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

/**
 * Zod schema for validating IPC requests.
 */
export const IpcRequestSchema = z.object({
    id: z.string(),
    method: z.string(),
    params: z.unknown().optional(),
});

/**
 * An IPC request message.
 */
export type IpcRequest = z.infer<typeof IpcRequestSchema>;

/**
 * An IPC error object.
 */
export type IpcError = {
    /** Error code */
    code: number;
    /** Error message */
    message: string;
    /** Additional error data */
    data?: unknown;
};

/**
 * Zod schema for validating IPC errors.
 */
export const IpcErrorSchema = z.object({
    code: z.number(),
    message: z.string(),
    data: z.unknown().optional(),
});

/**
 * Zod schema for validating IPC responses.
 */
export const IpcResponseSchema = z.object({
    id: z.string(),
    result: z.unknown().optional(),
    error: IpcErrorSchema.optional(),
});

/**
 * An IPC response message.
 */
export type IpcResponse = z.infer<typeof IpcResponseSchema>;

/**
 * A serialized representation of a GTK widget for IPC transfer.
 */
export type SerializedWidget = {
    /** Unique widget identifier */
    id: string;
    /** Widget type name (e.g., "GtkButton") */
    type: string;
    /** Accessible role */
    role: string;
    /** Widget name (test ID) */
    name: string | null;
    /** Accessible label */
    label: string | null;
    /** Text content */
    text: string | null;
    /** Whether the widget is sensitive (interactive) */
    sensitive: boolean;
    /** Whether the widget is visible */
    visible: boolean;
    /** CSS class names */
    cssClasses: string[];
    /** Child widgets */
    children: SerializedWidget[];
    /** Widget bounds in window coordinates */
    bounds?: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
};

/**
 * Information about a connected GTKX application.
 */
export type AppInfo = {
    /** Application ID (e.g., "com.example.myapp") */
    appId: string;
    /** Process ID */
    pid: number;
    /** Open windows */
    windows: Array<{
        id: string;
        title: string | null;
    }>;
};

/**
 * Options for widget queries.
 */
export type QueryOptions = {
    /** Widget name to match */
    name?: string;
    /** Require exact match */
    exact?: boolean;
    /** Query timeout in milliseconds */
    timeout?: number;
};

/**
 * Zod schema for app registration parameters.
 * @internal
 */
export const RegisterParamsSchema = z.object({
    appId: z.string(),
    pid: z.number(),
});

/**
 * Available IPC methods.
 */
export type IpcMethod =
    | "app.register"
    | "app.unregister"
    | "app.getWindows"
    | "widget.getTree"
    | "widget.query"
    | "widget.getProps"
    | "widget.click"
    | "widget.type"
    | "widget.fireEvent"
    | "widget.screenshot";

/**
 * Union type for any IPC message (request or response).
 */
export type IpcMessage = IpcRequest | IpcResponse;

/**
 * Gets the XDG runtime directory or falls back to system temp.
 *
 * @returns Path to the runtime directory
 */
export const getRuntimeDir = (): string => process.env.XDG_RUNTIME_DIR ?? tmpdir();

/**
 * Default path for the MCP socket file.
 */
export const DEFAULT_SOCKET_PATH = join(getRuntimeDir(), "gtkx-mcp.sock");
