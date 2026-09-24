import type * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { describe, expect, it } from "vitest";
import "@gtkx/gi/gobject";

describe("emitSignal — basic dispatch", () => {
    it("emits a void signal with no arguments and invokes connected handlers", () => {
        const button = new Gtk.Button();
        let calls = 0;
        button.on("clicked", () => {
            calls += 1;
        });
        button.emit("clicked");
        expect(calls).toBe(1);
    });

    it("emits a signal with primitive arguments and forwards them to the handler", () => {
        const window = new Gtk.Window();
        const received: boolean[] = [];
        window.on("enable-debugging", (enabled) => {
            received.push(enabled);
        });
        window.emit("enable-debugging", true);
        expect(received).toEqual([true]);
    });

    it("returns undefined from any signal emission", () => {
        const button = new Gtk.Button();
        let calls = 0;
        button.on("clicked", () => {
            calls += 1;
        });
        const emitClicked: (signal: "clicked") => unknown = button.emit.bind(button);
        expect(emitClicked("clicked")).toBeUndefined();
        expect(calls).toBe(1);
    });
});

describe("emitSignal — inheritance and errors", () => {
    it("emits an inherited signal via super.emit fallthrough", () => {
        const button = new Gtk.Button();
        let calls = 0;
        button.on("destroy", () => {
            calls += 1;
        });
        button.emit("destroy");
        expect(calls).toBe(1);
    });

    it("emits a signal with a GObject argument", () => {
        const listBox = new Gtk.ListBox();
        const row = new Gtk.ListBoxRow();
        listBox.append(row);
        const received: Gtk.ListBoxRow[] = [];
        listBox.on("row-activated", (activated) => {
            received.push(activated);
        });
        listBox.emit("row-activated", row);
        expect(received).toEqual([row]);
    });

    it("throws on an unknown signal at the GObject root", () => {
        const button = new Gtk.Button();

        const object = button as GObject.Object;
        expect(() => {
            Reflect.apply(object.emit.bind(object), object, ["not-a-real-signal"]);
        }).toThrow();
    });
});

describe("emitSignal — detailed signals", () => {
    it("delivers a detailed emission only to handlers watching that detail", () => {
        const bar = new Gtk.LevelBar();
        const scoped: string[] = [];
        const undetailed: string[] = [];
        bar.on("offset-changed::low", (name) => {
            scoped.push(name);
        });
        bar.on("offset-changed", (name) => {
            undetailed.push(name);
        });
        bar.emit("offset-changed::low", "low");
        bar.emit("offset-changed::high", "high");
        expect(scoped).toEqual(["low"]);
        expect(undetailed).toEqual(["low", "high"]);
    });

    it("delivers a notify detail only for the property that changed", () => {
        const button = new Gtk.Button();
        let calls = 0;
        button.on("notify::label", () => {
            calls += 1;
        });
        button.setLabel("changed");
        button.setOpacity(0.5);
        expect(calls).toBe(1);
    });
});
