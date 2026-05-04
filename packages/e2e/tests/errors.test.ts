import { GtkxError, toGtkxError } from "@gtkx/react";
import { describe, expect, it } from "vitest";

describe("GtkxError", () => {
    it("sets the error name to GtkxError", () => {
        expect(new GtkxError("boom").name).toBe("GtkxError");
    });

    it("captures the message and stores optional widgetType and componentStack", () => {
        const error = new GtkxError("render failed", "GtkButton", "  in App\n  in Root");
        expect(error.message).toBe("render failed");
        expect(error.widgetType).toBe("GtkButton");
        expect(error.componentStack).toBe("  in App\n  in Root");
    });

    it("toString returns just the prefixed message when no extra context is given", () => {
        expect(new GtkxError("boom").toString()).toBe("GtkxError: boom");
    });

    it("toString appends widget type and component stack lines when present", () => {
        const error = new GtkxError("render failed", "GtkButton", "  in App");
        expect(error.toString()).toBe(
            ["GtkxError: render failed", "Widget Type: GtkButton", "Component Stack:\n  in App"].join("\n"),
        );
    });

    it("toString includes only the present context fields", () => {
        expect(new GtkxError("boom", "GtkButton").toString()).toBe(
            ["GtkxError: boom", "Widget Type: GtkButton"].join("\n"),
        );
        expect(new GtkxError("boom", undefined, "  in App").toString()).toBe(
            ["GtkxError: boom", "Component Stack:\n  in App"].join("\n"),
        );
    });

    it("captures a stack trace when Error.captureStackTrace is available", () => {
        expect(typeof new GtkxError("boom").stack).toBe("string");
    });
});

describe("toGtkxError", () => {
    it("returns the same instance when given a GtkxError", () => {
        const error = new GtkxError("already gtkx", "GtkBox");
        expect(toGtkxError(error)).toBe(error);
    });

    it("wraps a plain Error using its message", () => {
        const wrapped = toGtkxError(new Error("oops"));
        expect(wrapped).toBeInstanceOf(GtkxError);
        expect(wrapped.message).toBe("oops");
    });

    it("uses the value verbatim when given a string", () => {
        expect(toGtkxError("string error").message).toBe("string error");
    });

    it("stringifies numbers and booleans", () => {
        expect(toGtkxError(42).message).toBe("42");
        expect(toGtkxError(false).message).toBe("false");
    });

    it("falls back to a generic message for objects and other values", () => {
        expect(toGtkxError({ random: "object" }).message).toBe("Unknown error");
        expect(toGtkxError(null).message).toBe("Unknown error");
        expect(toGtkxError(undefined).message).toBe("Unknown error");
    });
});
