/**
 * Error codes for MCP protocol errors.
 */
export enum McpErrorCode {
    /** Internal server error */
    INTERNAL_ERROR = 1000,
    /** No GTKX application is connected */
    NO_APP_CONNECTED = 1001,
    /** Requested application ID was not found */
    APP_NOT_FOUND = 1002,
    /** Widget with specified ID was not found */
    WIDGET_NOT_FOUND = 1003,
    /** Widget cannot be interacted with */
    WIDGET_NOT_INTERACTABLE = 1004,
    /** Query timed out waiting for widget */
    QUERY_TIMEOUT = 1005,
    /** Widget is not the expected type */
    INVALID_WIDGET_TYPE = 1006,
    /** Screenshot capture failed */
    SCREENSHOT_FAILED = 1007,
    /** IPC request timed out */
    IPC_TIMEOUT = 1008,
    /** Failed to serialize data */
    SERIALIZATION_ERROR = 1009,
    /** Request format is invalid */
    INVALID_REQUEST = 1010,
    /** Requested method does not exist */
    METHOD_NOT_FOUND = 1011,
}

/**
 * Error class for MCP protocol errors.
 *
 * Contains an error code, message, and optional additional data.
 */
export class McpError extends Error {
    /** The MCP error code */
    readonly code: McpErrorCode;
    /** Additional error context */
    readonly data?: unknown;

    constructor(code: McpErrorCode, message: string, data?: unknown) {
        super(message);
        this.code = code;
        this.data = data;
        this.name = "McpError";

        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, McpError);
        }
    }

    /**
     * Converts the error to an IPC-compatible format.
     *
     * @returns Object suitable for IPC response error field
     */
    toIpcError(): { code: number; message: string; data?: unknown } {
        return {
            code: this.code,
            message: this.message,
            ...(this.data !== undefined && { data: this.data }),
        };
    }
}

/**
 * Creates an error for when no GTKX application is connected.
 *
 * @returns McpError with NO_APP_CONNECTED code
 */
export function noAppConnectedError(): McpError {
    return new McpError(
        McpErrorCode.NO_APP_CONNECTED,
        "No GTKX application connected. Start an app with 'gtkx dev' to connect.",
        { hint: "Run 'gtkx dev src/app.tsx' in your project directory" },
    );
}

/**
 * Creates an error for when a requested app is not found.
 *
 * @param appId - The application ID that was not found
 * @returns McpError with APP_NOT_FOUND code
 */
export function appNotFoundError(appId: string): McpError {
    return new McpError(McpErrorCode.APP_NOT_FOUND, `Application '${appId}' not found`, { appId });
}

/**
 * Creates an error for when a widget is not found.
 *
 * @param widgetId - The widget ID that was not found
 * @returns McpError with WIDGET_NOT_FOUND code
 */
export function widgetNotFoundError(widgetId: string): McpError {
    return new McpError(McpErrorCode.WIDGET_NOT_FOUND, `Widget '${widgetId}' not found`, { widgetId });
}

/**
 * Creates an error for when an IPC request times out.
 *
 * @param timeout - The timeout duration in milliseconds
 * @returns McpError with IPC_TIMEOUT code
 */
export function ipcTimeoutError(timeout: number): McpError {
    return new McpError(McpErrorCode.IPC_TIMEOUT, `IPC request timed out after ${timeout}ms`, { timeout });
}

/**
 * Creates an error for invalid request format.
 *
 * @param reason - Description of why the request is invalid
 * @returns McpError with INVALID_REQUEST code
 */
export function invalidRequestError(reason: string): McpError {
    return new McpError(McpErrorCode.INVALID_REQUEST, `Invalid request: ${reason}`, { reason });
}

/**
 * Creates an error for when a method is not found.
 *
 * @param method - The method name that was not found
 * @returns McpError with METHOD_NOT_FOUND code
 */
export function methodNotFoundError(method: string): McpError {
    return new McpError(McpErrorCode.METHOD_NOT_FOUND, `Method '${method}' not found`, { method });
}
