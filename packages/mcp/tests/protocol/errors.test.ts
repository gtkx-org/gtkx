import { describe, expect, it } from "vitest";
import {
    appNotFoundError,
    ErrorCode,
    invalidRequestError,
    methodNotFoundError,
    noAppConnectedError,
    ProtocolError,
    requestTimeoutError,
    widgetNotFoundError,
} from "../../src/protocol/errors.js";

describe("ProtocolError", () => {
    it("creates an error with code and message", () => {
        const error = new ProtocolError(ErrorCode.INTERNAL_ERROR, "Something went wrong");

        expect(error.code).toBe(ErrorCode.INTERNAL_ERROR);
        expect(error.message).toBe("Something went wrong");
        expect(error.name).toBe("ProtocolError");
    });

    it("includes optional data", () => {
        const data = { widgetId: "123" };
        const error = new ProtocolError(ErrorCode.WIDGET_NOT_FOUND, "Widget not found", data);

        expect(error.data).toEqual(data);
    });

    it("converts to error object format", () => {
        const error = new ProtocolError(ErrorCode.INTERNAL_ERROR, "Test", { extra: "data" });
        const errorObject = error.toErrorObject();

        expect(errorObject).toEqual({
            code: ErrorCode.INTERNAL_ERROR,
            message: "Test",
            data: { extra: "data" },
        });
    });

    it("omits data from error object when undefined", () => {
        const error = new ProtocolError(ErrorCode.INTERNAL_ERROR, "Test");
        const errorObject = error.toErrorObject();

        expect(errorObject).toEqual({
            code: ErrorCode.INTERNAL_ERROR,
            message: "Test",
        });
        expect("data" in errorObject).toBe(false);
    });
});

describe("noAppConnectedError", () => {
    it("noAppConnectedError creates correct error", () => {
        const error = noAppConnectedError();

        expect(error.code).toBe(ErrorCode.NO_APP_CONNECTED);
        expect(error.message).toContain("No GTKX application connected");
    });
});

describe("appNotFoundError", () => {
    it("appNotFoundError creates correct error", () => {
        const error = appNotFoundError("my-app");

        expect(error.code).toBe(ErrorCode.APP_NOT_FOUND);
        expect(error.message).toContain("my-app");
        expect(error.data).toEqual({ applicationId: "my-app" });
    });
});

describe("widgetNotFoundError", () => {
    it("widgetNotFoundError creates correct error", () => {
        const error = widgetNotFoundError("widget-123");

        expect(error.code).toBe(ErrorCode.WIDGET_NOT_FOUND);
        expect(error.message).toContain("widget-123");
        expect(error.data).toEqual({ widgetId: "widget-123" });
    });
});

describe("requestTimeoutError", () => {
    it("requestTimeoutError creates correct error", () => {
        const error = requestTimeoutError(5000);

        expect(error.code).toBe(ErrorCode.REQUEST_TIMEOUT);
        expect(error.message).toContain("5000");
        expect(error.data).toEqual({ timeout: 5000 });
    });
});

describe("invalidRequestError", () => {
    it("invalidRequestError creates correct error", () => {
        const error = invalidRequestError("missing field");

        expect(error.code).toBe(ErrorCode.INVALID_REQUEST);
        expect(error.message).toContain("missing field");
        expect(error.data).toEqual({ reason: "missing field" });
    });
});

describe("methodNotFoundError", () => {
    it("methodNotFoundError creates correct error", () => {
        const error = methodNotFoundError("unknown.method");

        expect(error.code).toBe(ErrorCode.METHOD_NOT_FOUND);
        expect(error.message).toContain("unknown.method");
        expect(error.data).toEqual({ method: "unknown.method" });
    });
});
