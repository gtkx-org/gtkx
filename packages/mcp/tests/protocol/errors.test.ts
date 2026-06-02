import { describe, expect, it } from "vitest";
import {
    appNotFoundError,
    invalidRequestError,
    ipcTimeoutError,
    McpError,
    McpErrorCode,
    methodNotFoundError,
    noAppConnectedError,
    widgetNotFoundError,
} from "../../src/protocol/errors.js";

describe("McpError", () => {
    it("creates an error with code and message", () => {
        const error = new McpError(McpErrorCode.INTERNAL_ERROR, "Something went wrong");

        expect(error.code).toBe(McpErrorCode.INTERNAL_ERROR);
        expect(error.message).toBe("Something went wrong");
        expect(error.name).toBe("McpError");
    });

    it("includes optional data", () => {
        const data = { widgetId: "123" };
        const error = new McpError(McpErrorCode.WIDGET_NOT_FOUND, "Widget not found", data);

        expect(error.data).toEqual(data);
    });

    it("converts to IPC error format", () => {
        const error = new McpError(McpErrorCode.INTERNAL_ERROR, "Test", { extra: "data" });
        const ipcError = error.toIpcError();

        expect(ipcError).toEqual({
            code: McpErrorCode.INTERNAL_ERROR,
            message: "Test",
            data: { extra: "data" },
        });
    });

    it("omits data from IPC error when undefined", () => {
        const error = new McpError(McpErrorCode.INTERNAL_ERROR, "Test");
        const ipcError = error.toIpcError();

        expect(ipcError).toEqual({
            code: McpErrorCode.INTERNAL_ERROR,
            message: "Test",
        });
        expect("data" in ipcError).toBe(false);
    });
});

describe("error factory functions", () => {
    it("noAppConnectedError creates correct error", () => {
        const error = noAppConnectedError();

        expect(error.code).toBe(McpErrorCode.NO_APP_CONNECTED);
        expect(error.message).toContain("No GTKX application connected");
    });

    it("appNotFoundError creates correct error", () => {
        const error = appNotFoundError("my-app");

        expect(error.code).toBe(McpErrorCode.APP_NOT_FOUND);
        expect(error.message).toContain("my-app");
        expect(error.data).toEqual({ applicationId: "my-app" });
    });

    it("widgetNotFoundError creates correct error", () => {
        const error = widgetNotFoundError("widget-123");

        expect(error.code).toBe(McpErrorCode.WIDGET_NOT_FOUND);
        expect(error.message).toContain("widget-123");
        expect(error.data).toEqual({ widgetId: "widget-123" });
    });

    it("ipcTimeoutError creates correct error", () => {
        const error = ipcTimeoutError(5000);

        expect(error.code).toBe(McpErrorCode.IPC_TIMEOUT);
        expect(error.message).toContain("5000");
        expect(error.data).toEqual({ timeout: 5000 });
    });

    it("invalidRequestError creates correct error", () => {
        const error = invalidRequestError("missing field");

        expect(error.code).toBe(McpErrorCode.INVALID_REQUEST);
        expect(error.message).toContain("missing field");
        expect(error.data).toEqual({ reason: "missing field" });
    });

    it("methodNotFoundError creates correct error", () => {
        const error = methodNotFoundError("unknown.method");

        expect(error.code).toBe(McpErrorCode.METHOD_NOT_FOUND);
        expect(error.message).toContain("unknown.method");
        expect(error.data).toEqual({ method: "unknown.method" });
    });
});
