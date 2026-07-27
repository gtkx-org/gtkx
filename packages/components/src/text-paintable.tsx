import type * as Gtk from "@gtkx/gi/gtk";
import type { ReactNode } from "react";
import { GtkTextMark } from "@gtkx/jsx/gtk";
import { useEffectEvent, useLayoutEffect, useState } from "react";
import type { TextPaintableProps } from "./types.js";

const deleteEmbeddedPaintable = (buffer: Gtk.TextBuffer, position: Gtk.TextIter): void => {
    if (position.getPaintable() === null) {
        return;
    }

    const after = position.copy();
    after.forwardChar();
    buffer.delete(position, after);
};

const removeEmbeddedPaintable = (mark: Gtk.TextMark): void => {
    const owner = mark.getBuffer();

    if (owner !== null) {
        deleteEmbeddedPaintable(owner, owner.getIterAtMark(mark));
    }
};

/**
 * Inserts a Gdk.Paintable into the enclosing GtkTextBuffer at its position in the
 * JSX text content, holding the spot with a left-gravity Gtk.TextMark and removing
 * the paintable on unmount.
 */
function TextPaintable(props: TextPaintableProps): ReactNode {
    const { paintable, onInserted } = props;
    const [mark, setMark] = useState<Gtk.TextMark | null>(null);

    const notifyInserted = useEffectEvent((buffer: Gtk.TextBuffer, inserted: Gtk.TextMark): void => {
        onInserted?.(buffer, inserted);
    });

    useLayoutEffect(() => {
        if (mark === null) {
            return;
        }

        const buffer = mark.getBuffer();

        if (buffer === null) {
            return;
        }

        buffer.insertPaintable(buffer.getIterAtMark(mark), paintable);
        notifyInserted(buffer, mark);

        return () => {
            removeEmbeddedPaintable(mark);
        };
    }, [mark, paintable]);

    return <GtkTextMark leftGravity ref={setMark} />;
}

export { TextPaintable };
