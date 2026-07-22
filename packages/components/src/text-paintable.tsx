import type * as Gdk from "@gtkx/gi/gdk";
import type * as Gtk from "@gtkx/gi/gtk";
import { GtkTextMark } from "@gtkx/jsx/gtk";
import { type ReactNode, useLayoutEffect, useRef } from "react";

/** Props for {@link TextPaintable}. */
export type TextPaintableProps = {
    /** The paintable inserted into the enclosing text buffer at this position. */
    paintable: Gdk.Paintable;
    /** Called with the buffer and the position mark right after the paintable is inserted. */
    onInserted?: (buffer: Gtk.TextBuffer, mark: Gtk.TextMark) => void;
};

/** Inserts a `Gdk.Paintable` into the enclosing `GtkTextBuffer` at this position in the content. */
export const TextPaintable = ({ paintable, onInserted }: TextPaintableProps): ReactNode => {
    const markRef = useRef<Gtk.TextMark | null>(null);
    useLayoutEffect(() => {
        const mark = markRef.current;
        const buffer = mark?.getBuffer();
        if (!mark || !buffer) return;
        buffer.insertPaintable(buffer.getIterAtMark(mark), paintable);
        onInserted?.(buffer, mark);
        return () => {
            if (mark.getBuffer() !== buffer) return;
            const start = buffer.getIterAtMark(mark);
            if (start.getPaintable() === null) return;
            const end = buffer.getIterAtMark(mark);
            end.forwardChar();
            buffer.delete(start, end);
        };
    }, [paintable, onInserted]);
    return <GtkTextMark leftGravity ref={markRef} />;
};
