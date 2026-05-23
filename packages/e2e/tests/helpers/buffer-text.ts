import type * as Gtk from "@gtkx/ffi/gtk";
import type * as GtkSource from "@gtkx/ffi/gtksource";
import type { RefObject } from "react";

/**
 * Returns the full text of a `Gtk.TextBuffer` from its first to last iterator.
 *
 * The trailing `true` passed to `getText` includes invisible and embedded
 * characters, matching what the widget actually holds.
 */
export const getBufferText = (buffer: Gtk.TextBuffer): string => {
    const startIter = buffer.getStartIter();
    const endIter = buffer.getEndIter();
    return buffer.getText(startIter, endIter, true) ?? "";
};

/** Returns the `GtkSource.Buffer` attached to a `GtkSource.View` ref. */
export const getSourceBuffer = (ref: RefObject<GtkSource.View | null>): GtkSource.Buffer =>
    ref.current?.getBuffer() as GtkSource.Buffer;

/** Returns the `Gtk.TextBuffer` attached to a `Gtk.TextView` ref. */
export const getTextBuffer = (ref: RefObject<Gtk.TextView | null>): Gtk.TextBuffer =>
    ref.current?.getBuffer() as Gtk.TextBuffer;
