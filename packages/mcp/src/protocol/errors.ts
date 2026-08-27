import { McpError, ErrorCode as SdkErrorCode } from "@modelcontextprotocol/sdk/types.js";

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
    PROPERTY_NOT_FOUND: 1008,
} as const;

const CONNECTION_CLOSED_CODE: number = SdkErrorCode.ConnectionClosed;
const REQUEST_TIMEOUT_CODE: number = SdkErrorCode.RequestTimeout;

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

function propertyNotFoundError(widgetType: string, property: string, readableProperties: string[]): ProtocolError {
    return new ProtocolError(
        ErrorCode.PROPERTY_NOT_FOUND,
        `${widgetType} has no readable property '${property}'`,
        {
            widgetType,
            property,
            hint: `Readable properties of ${widgetType}: ${readableProperties.join(", ")}`,
        },
    );
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

function isConnectionClosedError(value: unknown): boolean {
    return value instanceof McpError && value.code === CONNECTION_CLOSED_CODE;
}

function protocolErrorFrom(error: McpError): ProtocolError {
    const prefix = `MCP error ${String(error.code)}: `;
    const message = error.message.startsWith(prefix) ? error.message.slice(prefix.length) : error.message;

    return new ProtocolError(isErrorCode(error.code) ? error.code : ErrorCode.INTERNAL_ERROR, message, error.data);
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
}

export {
    CONNECTION_CLOSED_CODE,
    isConnectionClosedError,
    REQUEST_TIMEOUT_CODE,
    noAppConnectedError,
    appNotFoundError,
    connectionWriteFailedError,
    widgetNotFoundError,
    propertyNotFoundError,
    requestTimeoutError,
    invalidRequestError,
    methodNotFoundError,
    ProtocolError,
    protocolErrorFrom,
};
