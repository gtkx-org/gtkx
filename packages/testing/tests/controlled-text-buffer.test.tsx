import * as Gtk from "@gtkx/gi/gtk";
import { GtkTextBuffer, GtkTextView } from "@gtkx/jsx/gtk";
import { type ReactNode, useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen, userEvent } from "../src/index.js";
import { bufferText, caretOffset } from "./text-buffer-helpers.js";

const ControlledNotes = ({ initial }: { initial: string }): ReactNode => {
    const [notes, setNotes] = useState(initial);

    return (
        <GtkTextView
            buffer={(
                <GtkTextBuffer
                    enableUndo
                    text={notes}
                    onChanged={(buffer) => {
                        setNotes(buffer.getText(buffer.getStartIter(), buffer.getEndIter(), false));
                    }}
                />
            )}
        />
    );
};

describe("controlled GtkTextBuffer through the text prop", () => {
    it("seeds the buffer without putting the initial text on the undo stack", async () => {
        await render(<ControlledNotes initial="seed" />);
        const view = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX, { as: Gtk.TextView });
        expect(bufferText(view)).toBe("seed");
        expect(view.getBuffer().getCanUndo()).toBe(false);
        view.grabFocus();
        await userEvent.keyboard(view, "{Control>}z{/Control}");
        expect(bufferText(view)).toBe("seed");
    });

    it("keeps the caret in place while each keystroke round-trips through React state", async () => {
        await render(<ControlledNotes initial="hello" />);
        const view = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX, { as: Gtk.TextView });
        view.grabFocus();
        await userEvent.keyboard(view, "{Home}{ArrowRight}{ArrowRight}");
        expect(caretOffset(view)).toBe(2);
        await userEvent.type(view, "X");
        expect(bufferText(view)).toBe("heXllo");
        expect(caretOffset(view)).toBe(3);
    });

    it("undoes the user's own edits and stops at the seed", async () => {
        await render(<ControlledNotes initial="hello" />);
        const view = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX, { as: Gtk.TextView });
        view.grabFocus();
        await userEvent.type(view, "!");
        expect(bufferText(view)).toBe("hello!");
        await userEvent.keyboard(view, "{Control>}z{/Control}");
        expect(bufferText(view)).toBe("hello");
        await userEvent.keyboard(view, "{Control>}z{/Control}");
        expect(bufferText(view)).toBe("hello");
    });
});
