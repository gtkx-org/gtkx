import type { ReactNode } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwEntryRow } from "@gtkx/jsx/adw";
import {
    GtkBox,
    GtkButton,
    GtkEntry,
    GtkListBox,
    GtkPasswordEntry,
    GtkSearchEntry,
    GtkTextBuffer,
    GtkTextTag,
    GtkTextView,
} from "@gtkx/jsx/gtk";
import { render, screen, userEvent } from "@gtkx/testing";
import { describe, expect, it } from "vitest";

type ClipboardTarget = Gtk.Editable | Gtk.TextView;

const renderClipboardPair = async (source: ReactNode): Promise<Gtk.Entry> => {
    await render(
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            {source}
            <GtkEntry name="destination" />
        </GtkBox>,
    );

    return screen.getByName("destination", { as: Gtk.Entry });
};

const selectAll = (widget: ClipboardTarget): void => {
    if (widget instanceof Gtk.TextView) {
        const buffer = widget.getBuffer();
        buffer.selectRange(buffer.getStartIter(), buffer.getEndIter());

        return;
    }

    widget.selectRegion(0, -1);
};

describe("clipboard editing", () => {
    it.each([
        <GtkSearchEntry name="source" text="Copy me" />,
        <GtkListBox><AdwEntryRow name="source" title="Name" text="Copy me" /></GtkListBox>,
    ])("copies through an editable delegate: %s", async (element) => {
        const destination = await renderClipboardPair(element);
        const source = screen.getByName("source");

        if (!(source instanceof Gtk.Editable)) {
            throw new TypeError("Missing editable");
        }

        selectAll(source);
        await userEvent.copy(source);
        await userEvent.paste(destination);
        expect(destination).toHaveDisplayValue("Copy me");
        expect(source.getText()).toBe("Copy me");
    });

    it.each(["entry", "text-view"])("keeps readonly %s text intact when cut", async (kind) => {
        const source = kind === "entry"
            ? <GtkEntry name="source" text="Read only" editable={false} />
            : <GtkTextView name="source" editable={false} buffer={<GtkTextBuffer text="Read only" />} />;

        await renderClipboardPair(source);
        const widget = screen.getByName("source", { as: Gtk.Widget });

        if (!(widget instanceof Gtk.Entry) && !(widget instanceof Gtk.TextView)) {
            throw new TypeError("Missing editable");
        }

        selectAll(widget);
        await userEvent.cut(widget);
        expect(widget).toHaveDisplayValue("Read only");
    });

    it("cuts only editable text and lets the native undo history restore it", async () => {
        const destination = await renderClipboardPair(
            <GtkTextView
                name="source"
                buffer={(
                    <GtkTextBuffer enableUndo>
                        {"Remove "}
                        <GtkTextTag name="protected" editable={false}>keep</GtkTextTag>
                    </GtkTextBuffer>
                )}
            />,
        );

        const source = screen.getByName("source", { as: Gtk.TextView });
        selectAll(source);
        await userEvent.cut(source);
        expect(source).toHaveDisplayValue("keep");
        await userEvent.paste(destination);
        expect(destination).toHaveDisplayValue("Remove keep");
        await userEvent.keyboard(source, "{Control>}z{/Control}");
        expect(source).toHaveDisplayValue("Remove keep");
    });

    it.each(["copy", "cut"] as const)("does not %s hidden password text", async (action) => {
        const destination = await renderClipboardPair(<GtkPasswordEntry name="source" text="secret" />);
        destination.getClipboard().set("previous");
        const source = screen.getByName("source", { as: Gtk.PasswordEntry });
        selectAll(source);
        await userEvent[action](source);
        await userEvent.paste(destination);
        expect(destination).toHaveDisplayValue("previous");
        expect(source).toHaveDisplayValue("secret");
    });

    it.each(["copy", "cut"] as const)("keeps clipboard content when %s has no selection", async (action) => {
        const destination = await renderClipboardPair(<GtkEntry name="source" text="Unselected" />);
        destination.getClipboard().set("previous");
        const source = screen.getByName("source", { as: Gtk.Entry });
        source.selectRegion(0, 0);
        await userEvent[action](source);
        await userEvent.paste(destination);
        expect(destination).toHaveDisplayValue("previous");
        expect(source).toHaveDisplayValue("Unselected");
    });

    it.each(["copy", "cut"] as const)("rejects %s on a non-editable widget", async (action) => {
        await render(<GtkButton name="button" label="Button" />);
        await expect(userEvent[action](screen.getByName("button"))).rejects.toThrow();
    });
});
