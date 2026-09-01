import type * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { describe, expect, it, vi } from "vitest";
import "@gtkx/gi/gobject";

describe("emitSignal — basic dispatch", () => {
    it("emits a void signal with no arguments and invokes connected handlers", () => {
        const button = new Gtk.Button();
        const handler = vi.fn();
        button.on("clicked", handler);
        button.emit("clicked");
        expect(handler).toHaveBeenCalledExactlyOnceWith();
    });

    it("emits a signal with primitive arguments and forwards them to the handler", () => {
        const window = new Gtk.Window();
        const handler = vi.fn();
        window.on("enable-debugging", handler);
        window.emit("enable-debugging", true);
        expect(handler).toHaveBeenCalledExactlyOnceWith(true);
    });

    it("returns undefined from any signal emission", () => {
        const button = new Gtk.Button();
        button.on("clicked", vi.fn());
        const emitClicked: (signal: "clicked") => unknown = button.emit.bind(button);
        expect(emitClicked("clicked")).toBeUndefined();
    });
});

describe("emitSignal — inheritance and errors", () => {
    it("emits an inherited signal via super.emit fallthrough", () => {
        const button = new Gtk.Button();
        const handler = vi.fn();
        button.on("destroy", handler);
        button.emit("destroy");
        expect(handler).toHaveBeenCalledOnce();
    });

    it("emits a signal with a GObject argument", () => {
        const listBox = new Gtk.ListBox();
        const row = new Gtk.ListBoxRow();
        listBox.append(row);
        const handler = vi.fn();
        listBox.on("row-activated", handler);
        listBox.emit("row-activated", row);
        expect(handler).toHaveBeenCalledExactlyOnceWith(row);
    });

    it("throws on an unknown signal at the GObject root", () => {
        const button = new Gtk.Button();

        expect(() => (button as GObject.Object).emit("not-a-real-signal")).toThrow();
    });
});

describe("emitSignal — detailed signals", () => {
    it("delivers a detailed emission only to handlers watching that detail", () => {
        const bar = new Gtk.LevelBar();
        const scoped = vi.fn();
        const undetailed = vi.fn();
        bar.on("offset-changed::low", scoped);
        bar.on("offset-changed", undetailed);
        bar.emit("offset-changed::low", "low");
        bar.emit("offset-changed::high", "high");
        expect(scoped).toHaveBeenCalledExactlyOnceWith("low");
        expect(undetailed).toHaveBeenCalledTimes(2);
    });

    it("delivers a notify detail only for the property that changed", () => {
        const button = new Gtk.Button();
        const scoped = vi.fn();
        button.on("notify::label", scoped);
        button.setLabel("changed");
        button.setOpacity(0.5);
        expect(scoped).toHaveBeenCalledOnce();
    });
});
