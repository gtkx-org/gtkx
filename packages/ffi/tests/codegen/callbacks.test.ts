import { describe, expect, it, vi } from "vitest";
import * as Gtk from "../../src/generated/gtk/index.js";

describe("callbacks", () => {
    describe("tick callbacks", () => {
        it("accepts tick callback function", () => {
            const button = new Gtk.Button();
            const tickCallback = vi.fn(() => true);
            const destroyNotify = vi.fn();

            const id = button.addTickCallback(tickCallback, destroyNotify);

            expect(typeof id).toBe("number");
            expect(id).toBeGreaterThan(0);
        });

        it("can remove tick callback by id", () => {
            const button = new Gtk.Button();
            const tickCallback = vi.fn(() => true);
            const destroyNotify = vi.fn();

            const id = button.addTickCallback(tickCallback, destroyNotify);

            expect(() => {
                button.removeTickCallback(id);
            }).not.toThrow();
        });
    });

    describe("signal callbacks", () => {
        it("accepts signal handler callback", () => {
            const button = new Gtk.Button();
            const handler = vi.fn();

            const handlerId = button.connect("clicked", handler);

            expect(typeof handlerId).toBe("number");
            expect(handlerId).toBeGreaterThan(0);
        });

        it("accepts handler with typed parameters", () => {
            const button = new Gtk.Button();
            const handler = vi.fn((_self: Gtk.Button) => {});

            button.connect("clicked", handler);

            expect(handler).not.toHaveBeenCalled();
        });

        it("accepts handler with after flag", () => {
            const button = new Gtk.Button();
            const handler = vi.fn();

            const handlerId = button.connect("clicked", handler, true);

            expect(handlerId).toBeGreaterThan(0);
        });
    });

    describe("callback action", () => {
        it("CallbackAction class exists", () => {
            expect(Gtk.CallbackAction).toBeDefined();
        });

        it("CallbackAction is a constructor", () => {
            expect(typeof Gtk.CallbackAction).toBe("function");
        });
    });
});
