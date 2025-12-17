import { describe, expect, it, vi } from "vitest";
import * as Gtk from "../../src/generated/gtk/index.js";

describe("signals", () => {
    it("connects handler to signal with no parameters", () => {
        const button = new Gtk.Button();
        const handler = vi.fn();
        const handlerId = button.connect("clicked", handler);
        expect(typeof handlerId).toBe("number");
        expect(handlerId).toBeGreaterThan(0);
    });

    it("connects handler to different signal", () => {
        const button = new Gtk.Button();
        const handler = vi.fn();
        const handlerId = button.connect("activate", handler);
        expect(handlerId).toBeGreaterThan(0);
    });

    it("connects multiple handlers to same signal", () => {
        const button = new Gtk.Button();
        const handler1 = vi.fn();
        const handler2 = vi.fn();
        const id1 = button.connect("clicked", handler1);
        const id2 = button.connect("clicked", handler2);
        expect(id1).not.toBe(id2);
    });

    it("connects handler with after flag", () => {
        const button = new Gtk.Button();
        const handler = vi.fn();
        const handlerId = button.connect("clicked", handler, true);
        expect(handlerId).toBeGreaterThan(0);
    });

    it("connects handler to signal with enum parameter", () => {
        const button = new Gtk.Button();
        const handler = vi.fn((_self: Gtk.Button, _direction: Gtk.DirectionType) => {});
        const handlerId = button.connect("direction-changed", handler);
        expect(handlerId).toBeGreaterThan(0);
    });

    it("connects handler to signal with boolean return", () => {
        const button = new Gtk.Button();
        const handler = vi.fn((_self: Gtk.Button, _direction: Gtk.DirectionType) => false);
        const handlerId = button.connect("keynav-failed", handler);
        expect(handlerId).toBeGreaterThan(0);
    });

    it("connects handler to signal with multiple parameters", () => {
        const button = new Gtk.Button();
        const handler = vi.fn(
            (_self: Gtk.Button, _x: number, _y: number, _keyboardMode: boolean, _tooltip: Gtk.Tooltip) => false,
        );
        const handlerId = button.connect("query-tooltip", handler);
        expect(handlerId).toBeGreaterThan(0);
    });

    it("connects handler to notify signal", () => {
        const button = new Gtk.Button();
        const handler = vi.fn();
        const handlerId = button.connect("notify", handler);
        expect(handlerId).toBeGreaterThan(0);
    });

    it("connects handler using generic string signal", () => {
        const button = new Gtk.Button();
        const handler = vi.fn();
        const handlerId = button.connect("clicked", handler);
        expect(handlerId).toBeGreaterThan(0);
    });

    it("handler receives self as first parameter type", () => {
        const button = new Gtk.Button();
        button.connect("clicked", (self: Gtk.Button) => {
            expect(self).toBeInstanceOf(Gtk.Button);
        });
    });

    it("handler for direction-changed receives enum parameter type", () => {
        const button = new Gtk.Button();
        button.connect("direction-changed", (_self: Gtk.Button, direction: Gtk.TextDirection) => {
            expect(typeof direction).toBe("number");
        });
    });
});
