export const McpErrorCode = {
    INTERNAL_ERROR: 1000,
    NO_APP_CONNECTED: 1001,
    APP_NOT_FOUND: 1002,
    WIDGET_NOT_FOUND: 1003,
    CONNECTION_WRITE_FAILED: 1004,
    IPC_TIMEOUT: 1008,
    INVALID_REQUEST: 1010,
    METHOD_NOT_FOUND: 1011,
} as const;

export type McpErrorCode = (typeof McpErrorCode)[keyof typeof McpErrorCode];

export function isMcpErrorCode(code: number): code is McpErrorCode {
    return (Object.values(McpErrorCode) as number[]).includes(code);
}

export class McpError extends Error {
    code: McpErrorCode;
    data?: unknown;

    constructor(code: McpErrorCode, message: string, data?: unknown) {
        super(message);
        this.code = code;
        this.data = data;
        this.name = "McpError";
    }

    toIpcError(): { code: number; message: string; data?: unknown } {
        return {
            code: this.code,
            message: this.message,
            ...(this.data !== undefined && { data: this.data }),
        };
    }
}

export function noAppConnectedError(): McpError {
    return new McpError(
        McpErrorCode.NO_APP_CONNECTED,
        "No GTKX application connected: start an app with 'gtkx dev' to connect",
        { hint: "Run 'gtkx dev' in your project directory" },
    );
}

export function appNotFoundError(applicationId: string): McpError {
    return new McpError(McpErrorCode.APP_NOT_FOUND, `Application '${applicationId}' not found`, { applicationId });
}

export function connectionWriteFailedError(applicationId: string): McpError {
    return new McpError(
        McpErrorCode.CONNECTION_WRITE_FAILED,
        `Connection to application '${applicationId}' is no longer writable`,
        { applicationId },
    );
}

export function widgetNotFoundError(widgetId: string): McpError {
    return new McpError(McpErrorCode.WIDGET_NOT_FOUND, `Widget '${widgetId}' not found`, { widgetId });
}

export function ipcTimeoutError(timeout: number): McpError {
    return new McpError(McpErrorCode.IPC_TIMEOUT, `IPC request timed out after ${timeout}ms`, { timeout });
}

export function invalidRequestError(reason: string): McpError {
    return new McpError(McpErrorCode.INVALID_REQUEST, `Invalid request: ${reason}`, { reason });
}

export function methodNotFoundError(method: string): McpError {
    return new McpError(McpErrorCode.METHOD_NOT_FOUND, `Method '${method}' not found`, { method });
}
