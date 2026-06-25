export const IpcErrorCode = {
    INTERNAL_ERROR: 1000,
    NO_APP_CONNECTED: 1001,
    APP_NOT_FOUND: 1002,
    WIDGET_NOT_FOUND: 1003,
    CONNECTION_WRITE_FAILED: 1004,
    IPC_TIMEOUT: 1005,
    INVALID_REQUEST: 1006,
    METHOD_NOT_FOUND: 1007,
} as const;

export type IpcErrorCode = (typeof IpcErrorCode)[keyof typeof IpcErrorCode];

export function isIpcErrorCode(code: number): code is IpcErrorCode {
    return (Object.values(IpcErrorCode) as number[]).includes(code);
}

export class IpcError extends Error {
    code: IpcErrorCode;
    data?: unknown;

    constructor(code: IpcErrorCode, message: string, data?: unknown) {
        super(message);
        this.code = code;
        this.data = data;
        this.name = "IpcError";
    }

    toIpcError(): { code: number; message: string; data?: unknown } {
        return {
            code: this.code,
            message: this.message,
            ...(this.data !== undefined && { data: this.data }),
        };
    }
}

export function noAppConnectedError(): IpcError {
    return new IpcError(
        IpcErrorCode.NO_APP_CONNECTED,
        "No GTKX application connected: start an app with 'gtkx dev' to connect",
        { hint: "Run 'gtkx dev' in your project directory" },
    );
}

export function appNotFoundError(applicationId: string): IpcError {
    return new IpcError(IpcErrorCode.APP_NOT_FOUND, `Application '${applicationId}' not found`, { applicationId });
}

export function connectionWriteFailedError(applicationId: string): IpcError {
    return new IpcError(
        IpcErrorCode.CONNECTION_WRITE_FAILED,
        `Connection to application '${applicationId}' is no longer writable`,
        { applicationId },
    );
}

export function widgetNotFoundError(widgetId: string): IpcError {
    return new IpcError(IpcErrorCode.WIDGET_NOT_FOUND, `Widget '${widgetId}' not found`, { widgetId });
}

export function ipcTimeoutError(timeout: number): IpcError {
    return new IpcError(IpcErrorCode.IPC_TIMEOUT, `IPC request timed out after ${timeout}ms`, { timeout });
}

export function invalidRequestError(reason: string): IpcError {
    return new IpcError(IpcErrorCode.INVALID_REQUEST, `Invalid request: ${reason}`, { reason });
}

export function methodNotFoundError(method: string): IpcError {
    return new IpcError(IpcErrorCode.METHOD_NOT_FOUND, `Method '${method}' not found`, { method });
}
