import { describe, expect, it } from "vitest";
import { formatNullableReturn, qualifyType } from "../../../src/core/utils/type-qualification.js";

describe("qualifyType", () => {
    describe("primitives", () => {
        it("returns boolean unchanged", () => {
            expect(qualifyType("boolean", "Gtk")).toBe("boolean");
        });

        it("returns number unchanged", () => {
            expect(qualifyType("number", "Gtk")).toBe("number");
        });

        it("returns string unchanged", () => {
            expect(qualifyType("string", "Gtk")).toBe("string");
        });

        it("returns void unchanged", () => {
            expect(qualifyType("void", "Gtk")).toBe("void");
        });

        it("returns unknown unchanged", () => {
            expect(qualifyType("unknown", "Gtk")).toBe("unknown");
        });

        it("returns null unchanged", () => {
            expect(qualifyType("null", "Gtk")).toBe("null");
        });

        it("returns undefined unchanged", () => {
            expect(qualifyType("undefined", "Gtk")).toBe("undefined");
        });
    });

    describe("simple types", () => {
        it("qualifies simple class name", () => {
            expect(qualifyType("Button", "Gtk")).toBe("Gtk.Button");
        });

        it("qualifies with different namespace", () => {
            expect(qualifyType("HeaderBar", "Adw")).toBe("Adw.HeaderBar");
        });

        it("qualifies Widget type", () => {
            expect(qualifyType("Widget", "Gtk")).toBe("Gtk.Widget");
        });
    });

    describe("already qualified types", () => {
        it("returns already qualified type unchanged", () => {
            expect(qualifyType("Gio.File", "Gtk")).toBe("Gio.File");
        });

        it("returns cross-namespace qualified type unchanged", () => {
            expect(qualifyType("GLib.Variant", "Gtk")).toBe("GLib.Variant");
        });

        it("returns same-namespace qualified type unchanged", () => {
            expect(qualifyType("Gtk.Button", "Gtk")).toBe("Gtk.Button");
        });
    });

    describe("array types", () => {
        it("qualifies simple array element type", () => {
            expect(qualifyType("Button[]", "Gtk")).toBe("Gtk.Button[]");
        });

        it("returns primitive array unchanged", () => {
            expect(qualifyType("string[]", "Gtk")).toBe("string[]");
        });

        it("returns number array unchanged", () => {
            expect(qualifyType("number[]", "Gtk")).toBe("number[]");
        });

        it("returns boolean array unchanged", () => {
            expect(qualifyType("boolean[]", "Gtk")).toBe("boolean[]");
        });

        it("returns already qualified array unchanged", () => {
            expect(qualifyType("Gio.File[]", "Gtk")).toBe("Gio.File[]");
        });
    });

    describe("generic types", () => {
        it("returns generic type unchanged", () => {
            expect(qualifyType("Promise<Button>", "Gtk")).toBe("Promise<Button>");
        });

        it("returns Map type unchanged", () => {
            expect(qualifyType("Map<string, Widget>", "Gtk")).toBe("Map<string, Widget>");
        });

        it("returns nested generic unchanged", () => {
            expect(qualifyType("Array<Map<string, number>>", "Gtk")).toBe("Array<Map<string, number>>");
        });
    });

    describe("function types", () => {
        it("returns function type unchanged", () => {
            expect(qualifyType("(x: number) => void", "Gtk")).toBe("(x: number) => void");
        });

        it("returns complex function type unchanged", () => {
            expect(qualifyType("(a: string, b: number) => boolean", "Gtk")).toBe("(a: string, b: number) => boolean");
        });
    });

    describe("array with complex element types", () => {
        it("returns array with generic element unchanged", () => {
            expect(qualifyType("Promise<Button>[]", "Gtk")).toBe("Promise<Button>[]");
        });

        it("returns array with function element unchanged", () => {
            expect(qualifyType("((x: number) => void)[]", "Gtk")).toBe("((x: number) => void)[]");
        });
    });
});

describe("formatNullableReturn", () => {
    describe("non-void types", () => {
        it("appends | null when nullable", () => {
            expect(formatNullableReturn("Button", true)).toBe("Button | null");
        });

        it("returns type unchanged when not nullable", () => {
            expect(formatNullableReturn("Button", false)).toBe("Button");
        });

        it("handles string type with nullable", () => {
            expect(formatNullableReturn("string", true)).toBe("string | null");
        });

        it("handles string type without nullable", () => {
            expect(formatNullableReturn("string", false)).toBe("string");
        });

        it("handles complex type with nullable", () => {
            expect(formatNullableReturn("Gtk.Widget", true)).toBe("Gtk.Widget | null");
        });
    });

    describe("void type", () => {
        it("returns void unchanged even when nullable is true", () => {
            expect(formatNullableReturn("void", true)).toBe("void");
        });

        it("returns void unchanged when nullable is false", () => {
            expect(formatNullableReturn("void", false)).toBe("void");
        });
    });
});
