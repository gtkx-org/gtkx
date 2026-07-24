import type * as Gtk from "@gtkx/gi/gtk";
import { GtkTextMark } from "@gtkx/jsx/gtk";
import type { ReactNode } from "react";
import { useLayoutEffect, useState } from "react";
import { useLatest } from "./internal/use-latest.js";
import type { TextPaintableProps } from "./types.js";

const deleteEmbeddedPaintable = (buffer: Gtk.TextBuffer, position: Gtk.TextIter): void => {
    if (position.getPaintable() === null) return;
    const after = position.copy();
    after.forwardChar();
    buffer.delete(position, after);
};

/**
 * Inserts a Gdk.Paintable into the enclosing GtkTextBuffer at its position in the
 * JSX text content, holding the spot with a left-gravity Gtk.TextMark and removing
 * the paintable on unmount.
 */
export function TextPaintable(props: TextPaintableProps): ReactNode {
    const { paintable, onInserted } = props;
    const [mark, setMark] = useState<Gtk.TextMark | null>(null);
    const handlers = useLatest({ onInserted });
    useLayoutEffect(() => {
        if (mark === null) return;
        const buffer = mark.getBuffer();
        if (buffer === null) return;
        buffer.insertPaintable(buffer.getIterAtMark(mark), paintable);
        handlers.current.onInserted?.(buffer, mark);
        return () => {
            const owner = mark.getBuffer();
            if (owner !== null) deleteEmbeddedPaintable(owner, owner.getIterAtMark(mark));
        };
    }, [mark, paintable, handlers]);
    return <GtkTextMark leftGravity ref={setMark} />;
}
