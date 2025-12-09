import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as Gtk from "../src/generated/gtk/index.js";
import { getCurrentApp, getObject, isInstanceOf, start, stop } from "../src/native.js";

const APP_ID = "com.gtkx.test.ffi";

describe("native module", () => {
    beforeAll(() => {
        start(APP_ID);
    });

    afterAll(() => {
        stop();
    });

    describe("isInstanceOf", () => {
        it("returns true for exact type match", () => {
            const button = new Gtk.Button();
            expect(isInstanceOf(button, Gtk.Button)).toBe(true);
        });

        it("returns false for non-matching type", () => {
            const button = new Gtk.Button();
            expect(isInstanceOf(button, Gtk.Label)).toBe(false);
        });

        it("returns false when checking child type against parent instance", () => {
            const widget = new Gtk.Box(Gtk.Orientation.HORIZONTAL, 0);
            expect(isInstanceOf(widget, Gtk.Button)).toBe(false);
        });

        it("works with ApplicationWindow", () => {
            const app = getCurrentApp();
            const window = new Gtk.ApplicationWindow(app);
            expect(isInstanceOf(window, Gtk.ApplicationWindow)).toBe(true);
            expect(isInstanceOf(window, Gtk.Window)).toBe(false);
            expect(isInstanceOf(window, Gtk.Button)).toBe(false);
        });

        it("works with Box", () => {
            const box = new Gtk.Box(Gtk.Orientation.VERTICAL, 10);
            expect(isInstanceOf(box, Gtk.Box)).toBe(true);
            expect(isInstanceOf(box, Gtk.Label)).toBe(false);
        });

        it("works with Label", () => {
            const label = new Gtk.Label("Test");
            expect(isInstanceOf(label, Gtk.Label)).toBe(true);
            expect(isInstanceOf(label, Gtk.Button)).toBe(false);
        });

        it("works with Entry", () => {
            const entry = new Gtk.Entry();
            expect(isInstanceOf(entry, Gtk.Entry)).toBe(true);
            expect(isInstanceOf(entry, Gtk.Label)).toBe(false);
        });

        it("works with getObject-wrapped pointers", () => {
            const button = new Gtk.Button();
            const wrapped = getObject(button.ptr, Gtk.Widget);
            expect(isInstanceOf(wrapped, Gtk.Button)).toBe(true);
            expect(isInstanceOf(wrapped, Gtk.Label)).toBe(false);
        });

        it("can narrow types correctly", () => {
            const widgets: { ptr: unknown }[] = [new Gtk.Button(), new Gtk.Label("Test"), new Gtk.Entry()];

            const buttons = widgets.filter((w): w is Gtk.Button => isInstanceOf(w, Gtk.Button));
            expect(buttons.length).toBe(1);
            expect(buttons[0]).toBeInstanceOf(Gtk.Button);

            const labels = widgets.filter((w): w is Gtk.Label => isInstanceOf(w, Gtk.Label));
            expect(labels.length).toBe(1);
            expect(labels[0]).toBeInstanceOf(Gtk.Label);
        });
    });

    describe("glibTypeName static property", () => {
        it("is defined on Widget", () => {
            expect(Gtk.Widget.glibTypeName).toBe("GtkWidget");
        });

        it("is defined on Button", () => {
            expect(Gtk.Button.glibTypeName).toBe("GtkButton");
        });

        it("is defined on Label", () => {
            expect(Gtk.Label.glibTypeName).toBe("GtkLabel");
        });

        it("is defined on ApplicationWindow", () => {
            expect(Gtk.ApplicationWindow.glibTypeName).toBe("GtkApplicationWindow");
        });

        it("is defined on Box", () => {
            expect(Gtk.Box.glibTypeName).toBe("GtkBox");
        });

        it("is defined on Entry", () => {
            expect(Gtk.Entry.glibTypeName).toBe("GtkEntry");
        });
    });
});
