import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwPasswordEntryRow } from "@gtkx/jsx/adw";
import { GtkEntry, GtkPasswordEntry, GtkTextBuffer, GtkTextView } from "@gtkx/jsx/gtk";
import { getWidgetText, prettyWidget, render, screen, userEvent } from "@gtkx/testing";
import { type ReactNode, useState } from "react";
import { describe, expect, it } from "vitest";
import { bufferText, caretOffset } from "./text-buffer-helpers.js";

const SECRET = "hunter2";

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

const renderNotes = async (initial: string): Promise<Gtk.TextView> => {
    await render(<ControlledNotes initial={initial} />);

    return screen.findByRole(Gtk.AccessibleRole.TEXT_BOX, { as: Gtk.TextView });
};

describe("controlled GtkTextBuffer through the text prop", () => {
    it("seeds the buffer without putting the initial text on the undo stack", async () => {
        const view = await renderNotes("seed");
        expect(bufferText(view)).toBe("seed");
        expect(view.getBuffer().getCanUndo()).toBe(false);
        view.grabFocus();
        await userEvent.keyboard(view, "{Control>}z{/Control}");
        expect(bufferText(view)).toBe("seed");
    });

    it("keeps the caret in place while each keystroke round-trips through React state", async () => {
        const view = await renderNotes("hello");
        view.grabFocus();
        await userEvent.keyboard(view, "{Home}{ArrowRight}{ArrowRight}");
        expect(caretOffset(view)).toBe(2);
        await userEvent.type(view, "X");
        expect(bufferText(view)).toBe("heXllo");
        expect(caretOffset(view)).toBe(3);
    });

    it("undoes the user's own edits and stops at the seed", async () => {
        const view = await renderNotes("hello");
        view.grabFocus();
        await userEvent.type(view, "!");
        expect(bufferText(view)).toBe("hello!");
        await userEvent.keyboard(view, "{Control>}z{/Control}");
        expect(bufferText(view)).toBe("hello");
        await userEvent.keyboard(view, "{Control>}z{/Control}");
        expect(bufferText(view)).toBe("hello");
    });
});

describe("password entry", () => {
    it("keeps its value available without exposing it as a name or debug text", async () => {
        await render(<GtkPasswordEntry name="password" text={SECRET} />);
        const entry = await screen.findByName("password", { as: Gtk.PasswordEntry });
        expect(getWidgetText(entry)).toBe(SECRET);
        expect(entry).toHaveDisplayValue(SECRET);
        expect(entry).not.toHaveAccessibleName();
        expect(prettyWidget(entry)).not.toContain(SECRET);
        expect(screen.queryByRole(Gtk.AccessibleRole.TEXT_BOX, { name: SECRET })).toBeNull();
        expect(() => screen.getByRole(Gtk.AccessibleRole.TEXT_BOX, { name: SECRET })).toThrow();
        expect(screen.getByRole(Gtk.AccessibleRole.TEXT_BOX)).toBe(entry);
    });

    it("uses an authored name, reports its selection and reads no text when it is empty", async () => {
        await render(<GtkPasswordEntry name="password" accessibleLabel="Account password" text={SECRET} />);
        const entry = await screen.findByName("password", { as: Gtk.PasswordEntry });
        expect(screen.getByRole(Gtk.AccessibleRole.TEXT_BOX, { name: "Account password" })).toBe(entry);
        expect(entry).toHaveAccessibleName("Account password");
        entry.selectRegion(0, -1);
        expect(entry).toHaveSelection(SECRET);
        await render(<GtkPasswordEntry name="empty" text="" />);
        expect(getWidgetText(await screen.findByName("empty"))).toBeNull();
    });

    it("redacts a regular entry whose text visibility is disabled", async () => {
        await render(<GtkEntry name="concealed" text={SECRET} visibility={false} />);
        const entry = await screen.findByName("concealed", { as: Gtk.Entry });
        expect(getWidgetText(entry)).toBe(SECRET);
        expect(entry).toHaveDisplayValue(SECRET);
        expect(entry).not.toHaveAccessibleName();
        expect(prettyWidget(entry)).not.toContain(SECRET);
    });

    it("uses an Adwaita password row title as its authored name without dumping its value", async () => {
        await render(<AdwPasswordEntryRow title="Account password" text={SECRET} />);
        const row = await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { as: Adw.PasswordEntryRow });
        const field = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX, { name: "Account password" });
        expect(getWidgetText(row)).toBe(SECRET);
        expect(field).toHaveDisplayValue(SECRET);
        expect(row).toHaveAccessibleName(/Account password/);
        expect(prettyWidget(row)).toContain("Account password");
        expect(prettyWidget(row)).not.toContain(SECRET);
    });
});
