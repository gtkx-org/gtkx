import type * as Gtk from "@gtkx/gi/gtk";
import { getBufferText } from "../helpers/buffer-text.js";

const bufferText = (view: Gtk.TextView): string => getBufferText(view.getBuffer());

const caretOffset = (view: Gtk.TextView): number => {
    const buffer = view.getBuffer();

    return buffer.getIterAtMark(buffer.getInsert()).getOffset();
};

export { bufferText, caretOffset };
