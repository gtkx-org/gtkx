import { describe, expect, it } from "vitest";
import * as Gtk from "../../src/generated/gtk/index.js";

describe("enums", () => {
    describe("enum values", () => {
        it("has numeric enum values", () => {
            expect(typeof Gtk.Orientation.HORIZONTAL).toBe("number");
            expect(typeof Gtk.Orientation.VERTICAL).toBe("number");
        });

        it("has distinct enum values", () => {
            expect(Gtk.Orientation.HORIZONTAL).not.toBe(Gtk.Orientation.VERTICAL);
        });

        it("has expected Orientation values", () => {
            expect(Gtk.Orientation.HORIZONTAL).toBe(0);
            expect(Gtk.Orientation.VERTICAL).toBe(1);
        });

        it("has Justification enum values", () => {
            expect(typeof Gtk.Justification.LEFT).toBe("number");
            expect(typeof Gtk.Justification.RIGHT).toBe("number");
            expect(typeof Gtk.Justification.CENTER).toBe("number");
            expect(typeof Gtk.Justification.FILL).toBe("number");
        });

        it("has Align enum values", () => {
            expect(typeof Gtk.Align.FILL).toBe("number");
            expect(typeof Gtk.Align.START).toBe("number");
            expect(typeof Gtk.Align.END).toBe("number");
            expect(typeof Gtk.Align.CENTER).toBe("number");
            expect(typeof Gtk.Align.BASELINE_FILL).toBe("number");
            expect(typeof Gtk.Align.BASELINE_CENTER).toBe("number");
        });
    });

    describe("enum as parameter", () => {
        it("passes enum to constructor", () => {
            const box = new Gtk.Box(Gtk.Orientation.VERTICAL, 0);
            expect(box.getOrientation()).toBe(Gtk.Orientation.VERTICAL);
        });

        it("passes enum to setter method", () => {
            const label = new Gtk.Label("Test");
            label.setJustify(Gtk.Justification.CENTER);
            expect(label.getJustify()).toBe(Gtk.Justification.CENTER);
        });

        it("passes enum to widget alignment", () => {
            const widget = new Gtk.Label("Test");
            widget.setHalign(Gtk.Align.CENTER);
            expect(widget.getHalign()).toBe(Gtk.Align.CENTER);
        });
    });

    describe("enum as return value", () => {
        it("returns enum from getter", () => {
            const box = new Gtk.Box(Gtk.Orientation.HORIZONTAL, 0);
            const orientation = box.getOrientation();
            expect(orientation).toBe(Gtk.Orientation.HORIZONTAL);
        });

        it("returns enum matching set value", () => {
            const label = new Gtk.Label("Test");
            label.setJustify(Gtk.Justification.RIGHT);
            const justify = label.getJustify();
            expect(justify).toBe(Gtk.Justification.RIGHT);
        });
    });

    describe("flags enums", () => {
        it("has StateFlags enum", () => {
            expect(typeof Gtk.StateFlags.NORMAL).toBe("number");
            expect(typeof Gtk.StateFlags.ACTIVE).toBe("number");
            expect(typeof Gtk.StateFlags.PRELIGHT).toBe("number");
            expect(typeof Gtk.StateFlags.SELECTED).toBe("number");
            expect(typeof Gtk.StateFlags.INSENSITIVE).toBe("number");
        });

        it("can combine flags with bitwise OR", () => {
            const combined = Gtk.StateFlags.ACTIVE | Gtk.StateFlags.PRELIGHT;
            expect(typeof combined).toBe("number");
            expect(combined).toBe(Gtk.StateFlags.ACTIVE + Gtk.StateFlags.PRELIGHT);
        });
    });
});
