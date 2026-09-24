import type * as Gtk from "@gtkx/gi/gtk";
import type * as GtkSource from "@gtkx/gi/gtksource";
import type { RefObject } from "react";

const getBufferText = (buffer: Gtk.TextBuffer): string => {
    const startIter = buffer.getStartIter();
    const endIter = buffer.getEndIter();

    return buffer.getText(startIter, endIter, true);
};

const getSourceBuffer = (ref: RefObject<GtkSource.View | null>): GtkSource.Buffer => {
    if (ref.current === null) {
        throw new Error("Source view did not mount");
    }

    return ref.current.getBuffer() as GtkSource.Buffer;
};

const getTextBuffer = (ref: RefObject<Gtk.TextView | null>): Gtk.TextBuffer => {
    if (ref.current === null) {
        throw new Error("Text view did not mount");
    }

    return ref.current.getBuffer();
};

export { getBufferText, getSourceBuffer, getTextBuffer };
