import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import * as GtkSource from "@gtkx/gi/gtksource";
import { GtkBox, GtkTextBuffer, GtkTextView } from "@gtkx/jsx/gtk";
import { GtkSourceView } from "@gtkx/jsx/gtksource";
import { getClassType, setProperty, t } from "@gtkx/runtime";
import { cleanup, render } from "@gtkx/testing";
import { setTimeout } from "node:timers/promises";
import { createRef } from "react";
import { afterEach, describe, expect, it } from "vitest";

type BufferWrite = (view: Gtk.TextView, buffer: Gtk.TextBuffer | null) => void;

const WRITES: { name: string; write: BufferWrite }[] = [
    { name: "setBuffer", write: (view, buffer) => {
        view.setBuffer(buffer);
    } },
    { name: "buffer property", write: (view, buffer) => {
        view.buffer = buffer;
    } },
    { name: "GObject.setProperty", write: (view, buffer) => {
        GObject.setProperty(view, "buffer", buffer);
    } },
    { name: "descriptor property write", write: (view, buffer) => {
        setProperty(view, "buffer", t.object("borrowed", () => Gtk.TextBuffer, "GtkTextBuffer"), buffer);
    } },
    { name: "GValue property write", write: (view, buffer) => {
        const value = new GObject.Value();
        value.init(getClassType(Gtk.TextBuffer));
        value.setObject(buffer);
        view.setProperty("buffer", value);
    } },
];

const renderTextView = async () => {
    const viewRef = createRef<Gtk.TextView>();
    const replacementRef = createRef<Gtk.TextBuffer>();

    await render(
        <GtkBox>
            <GtkTextView ref={viewRef} buffer={<GtkTextBuffer text="Before" />} />
            <GtkTextView buffer={<GtkTextBuffer ref={replacementRef} text="Replacement" />} />
        </GtkBox>,
    );

    if (viewRef.current === null || replacementRef.current === null) {
        throw new Error("The text view and replacement buffer must be mounted");
    }

    return { view: viewRef.current, replacement: replacementRef.current };
};

afterEach(cleanup);

describe("generated TextView buffer writes", () => {
    it.each(WRITES)("$name resets and replaces the buffer across native idle", async ({ write }) => {
        const { view, replacement } = await renderTextView();
        const original = view.getBuffer();

        expect(original.text).toBe("Before");
        write(view, null);
        await setTimeout(40);

        const reset = view.getBuffer();
        expect(reset).not.toBe(original);
        expect(reset.text).toBe("");
        write(view, replacement);
        await setTimeout(40);
        expect(view.getBuffer()).toBe(replacement);
        expect(view.buffer?.text).toBe("Replacement");

        write(view, null);
        write(view, null);
        await setTimeout(40);
        expect(view.getBuffer().text).toBe("");
    });

    it.each(WRITES)("$name rejects an incompatible value", async ({ write }) => {
        const { view } = await renderTextView();
        const original = view.getBuffer();

        expect(() => {
            Reflect.apply(write, undefined, [view, "invalid"]);
        }).toThrow();
        await setTimeout(40);
        expect(view.getBuffer()).toBe(original);
    });

    it.each(WRITES)("$name uses the native subclass's buffer factory", async ({ write }) => {
        const ref = createRef<GtkSource.View>();
        await render(<GtkSourceView ref={ref} />);

        if (ref.current === null) {
            throw new Error("The source view must be mounted");
        }

        const view = ref.current;
        const original = view.getBuffer();
        expect(original).toBeInstanceOf(GtkSource.Buffer);
        write(view, null);
        await setTimeout(40);

        const reset = view.getBuffer();
        expect(reset).toBeInstanceOf(GtkSource.Buffer);
        expect(reset).not.toBe(original);
    });
});
