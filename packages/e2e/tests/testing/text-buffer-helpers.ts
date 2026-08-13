import type * as Gtk from "@gtkx/gi/gtk";

const bufferText = (view: Gtk.TextView): string => {
    const buffer = view.getBuffer();
    const [start, end] = buffer.getBounds();

    return buffer.getText(start, end, true);
};

const caretOffset = (view: Gtk.TextView): number => {
    const buffer = view.getBuffer();

    return buffer.getIterAtMark(buffer.getInsert()).getOffset();
};

export { bufferText, caretOffset };
