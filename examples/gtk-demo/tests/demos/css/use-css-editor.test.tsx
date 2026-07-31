import * as Gtk from "@gtkx/gi/gtk";
import { GtkScrolledWindow, GtkTextBuffer, GtkTextView } from "@gtkx/jsx/gtk";
import { render, screen, userEvent } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { useCssEditor } from "../../../src/demos/css/use-css-editor.js";

type HostProps = {
    defaultCss: string;
};

const DEFAULT_CSS = "window { color: red; }";

const Host = ({ defaultCss }: HostProps) => {
    const { textViewRef, onChanged } = useCssEditor(defaultCss);

    return (
        <GtkScrolledWindow>
            <GtkTextView ref={textViewRef} buffer={<GtkTextBuffer onChanged={onChanged}>{defaultCss}</GtkTextBuffer>} />
        </GtkScrolledWindow>
    );
};

const renderHost = async (defaultCss: string): Promise<Gtk.TextView> => {
    await render(<Host defaultCss={defaultCss} />);

    return screen.findByRole(Gtk.AccessibleRole.TEXT_BOX, { as: Gtk.TextView });
};

describe("useCssEditor buffer", () => {
    it("populates the text buffer with the supplied default css", async () => {
        await renderHost(DEFAULT_CSS);
        expect(screen.getByDisplayValue(DEFAULT_CSS)).not.toBeNull();
    });

    it("registers warning and error text tags on the buffer's tag table", async () => {
        const textView = await renderHost(DEFAULT_CSS);
        const tagTable = textView.getBuffer().getTagTable();
        expect(tagTable.lookup("error")).not.toBeNull();
        expect(tagTable.lookup("warning")).not.toBeNull();
    });
});

describe("useCssEditor lifecycle", () => {
    it("updates the css provider when the buffer text changes and applies error tags on invalid css", async () => {
        const textView = await renderHost(DEFAULT_CSS);
        await userEvent.clear(textView);
        await userEvent.type(textView, "window { color: not-a-real-value; }");
        expect(screen.getByDisplayValue("window { color: not-a-real-value; }")).not.toBeNull();
        const tagTable = textView.getBuffer().getTagTable();
        expect(tagTable.lookup("error")).not.toBeNull();
    });
});
