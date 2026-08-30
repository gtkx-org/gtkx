import * as Gdk from "@gtkx/gi/gdk";
import * as GLib from "@gtkx/gi/glib";
import * as Gsk from "@gtkx/gi/gsk";
import * as Gtk from "@gtkx/gi/gtk";
import { describe, expect, it } from "vitest";
import { getBufferText } from "../helpers/buffer-text.js";

const SETTLE_ROUNDS = 20;
const SETTLE_PAUSE_MS = 10;

const settle = async (): Promise<void> => {
    for (let round = 0; round < SETTLE_ROUNDS; round++) {
        await new Promise((resolve) => setTimeout(resolve, SETTLE_PAUSE_MS));
    }
};

const insertingBuffer = (onInsert: (location: Gtk.TextIter) => void): Gtk.TextBuffer => {
    const buffer = new Gtk.TextBuffer();
    buffer.setText("abcdef", -1);
    buffer.connect("insert-text", onInsert);

    return buffer;
};

const insertAtStart = (buffer: Gtk.TextBuffer, text: string): void => {
    buffer.insert(buffer.getStartIter(), text, text.length);
};

const deserializeBadNode = (onError: (start: Gsk.ParseLocation) => void): void => {
    Gsk.RenderNode.deserialize(GLib.Bytes.new(new TextEncoder().encode("not a render node")), (start) => {
        onError(start);
    });
};

const getToplevel = (window: Gtk.Window): Gdk.Toplevel => {
    const surface = window.getSurface();

    if (!(surface instanceof Gdk.Toplevel)) {
        throw new TypeError("Expected the window's surface to be a GdkToplevel");
    }

    return surface;
};

describe("a boxed value a C caller lends to a callback", () => {
    it("happy path", () => {
        const offsets: number[] = [];
        const buffer = insertingBuffer((location) => {
            offsets.push(location.getOffset());
            location.forwardChars(3);
        });

        insertAtStart(buffer, "X");
        expect(offsets).toEqual([0]);
        expect(getBufferText(buffer)).toBe("abcXdef");
    });

    it("edge cases", async () => {
        const offsets: number[] = [];

        deserializeBadNode((start) => {
            offsets.push(start.bytes);
        });

        expect(offsets.length).toBeGreaterThan(0);
        expect(offsets.every((offset) => Number.isSafeInteger(offset))).toBe(true);

        const window = new Gtk.Window({ title: "lent-boxed", defaultWidth: 160, defaultHeight: 120 });
        window.present();
        const bounds: [number, number][] = [];

        getToplevel(window).connect("compute-size", (size) => {
            bounds.push(size.getBounds());
            size.setSize(321, 234);
        });

        await settle();
        window.destroy();
        expect(bounds.length).toBeGreaterThan(0);
    });

    it("error paths", () => {
        const escapedIter: Gtk.TextIter[] = [];
        const buffer = insertingBuffer((location) => {
            escapedIter.push(location);
        });

        insertAtStart(buffer, "X");
        expect(() => escapedIter[0]?.getOffset()).toThrow();
        expect(() => escapedIter[0]?.forwardChars(1)).toThrow();

        const escapedLocation: Gsk.ParseLocation[] = [];
        deserializeBadNode((start) => {
            escapedLocation.push(start);
        });

        expect(() => escapedLocation[0]?.bytes).toThrow();
    });
});
