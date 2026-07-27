type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

const ErrorCode = {
    INTERNAL_ERROR: 1000,
    NO_APP_CONNECTED: 1001,
    APP_NOT_FOUND: 1002,
    WIDGET_NOT_FOUND: 1003,
    CONNECTION_WRITE_FAILED: 1004,
    REQUEST_TIMEOUT: 1005,
    INVALID_REQUEST: 1006,
    METHOD_NOT_FOUND: 1007,
} as const;

function isErrorCode(code: number): code is ErrorCode {
    return (Object.values(ErrorCode) as number[]).includes(code);
}

function noAppConnectedError(): ProtocolError {
    return new ProtocolError(
        ErrorCode.NO_APP_CONNECTED,
        "No GTKX application connected: start an app with 'gtkx dev' to connect",
        { hint: "Run 'gtkx dev' in your project directory" },
    );
}

function appNotFoundError(applicationId: string): ProtocolError {
    return new ProtocolError(ErrorCode.APP_NOT_FOUND, `Application '${applicationId}' not found`, { applicationId });
}

function connectionWriteFailedError(applicationId: string): ProtocolError {
    return new ProtocolError(
        ErrorCode.CONNECTION_WRITE_FAILED,
        `Connection to application '${applicationId}' is no longer writable`,
        { applicationId },
    );
}

function widgetNotFoundError(widgetId: string): ProtocolError {
    return new ProtocolError(ErrorCode.WIDGET_NOT_FOUND, `Widget '${widgetId}' not found`, { widgetId });
}

function requestTimeoutError(timeout: number): ProtocolError {
    return new ProtocolError(ErrorCode.REQUEST_TIMEOUT, `Request timed out after ${String(timeout)}ms`, { timeout });
}

function invalidRequestError(reason: string): ProtocolError {
    return new ProtocolError(ErrorCode.INVALID_REQUEST, `Invalid request: ${reason}`, { reason });
}

function methodNotFoundError(method: string): ProtocolError {
    return new ProtocolError(ErrorCode.METHOD_NOT_FOUND, `Method '${method}' not found`, { method });
}

class ProtocolError extends Error {
    code: ErrorCode;
    data?: unknown;

    constructor(code: ErrorCode, message: string, data?: unknown) {
        super(message);
        this.code = code;
        this.data = data;
        this.name = "ProtocolError";
    }

    toErrorObject(): { code: number; message: string; data?: unknown } {
        return {
            code: this.code,
            message: this.message,
            ...(this.data !== undefined && { data: this.data }),
        };
    }
}

export {
    ErrorCode,
    isErrorCode,
    noAppConnectedError,
    appNotFoundError,
    connectionWriteFailedError,
    widgetNotFoundError,
    requestTimeoutError,
    invalidRequestError,
    methodNotFoundError,
    ProtocolError,
};
