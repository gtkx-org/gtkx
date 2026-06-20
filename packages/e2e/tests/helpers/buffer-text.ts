import type * as Gtk from "@gtkx/gi/gtk";
import type * as GtkSource from "@gtkx/gi/gtksource";
import type { RefObject } from "react";

export const getBufferText = (buffer: Gtk.TextBuffer): string => {
    const startIter = buffer.getStartIter();
    const endIter = buffer.getEndIter();
    return buffer.getText(startIter, endIter, true) ?? "";
};

export const getSourceBuffer = (ref: RefObject<GtkSource.View | null>): GtkSource.Buffer =>
    ref.current?.getBuffer() as GtkSource.Buffer;

export const getTextBuffer = (ref: RefObject<Gtk.TextView | null>): Gtk.TextBuffer =>
    ref.current?.getBuffer() as Gtk.TextBuffer;
