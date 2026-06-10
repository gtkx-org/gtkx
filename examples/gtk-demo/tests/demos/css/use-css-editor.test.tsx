import type * as Gtk from "@gtkx/gi/gtk";
import { GtkScrolledWindow, GtkTextBuffer, GtkTextView } from "@gtkx/jsx/gtk";
import { act, render } from "@gtkx/testing";
import { useEffect } from "react";
import { describe, expect, it } from "vitest";
import { useCssEditor } from "../../../src/demos/css/use-css-editor.js";

interface HostProps {
    defaultCss: string;
    onMount?: (tv: Gtk.TextView | null) => void;
}

const Host = ({ defaultCss, onMount }: HostProps) => {
    const editor = useCssEditor(defaultCss);

    useEffect(() => {
        onMount?.(editor.textViewRef.current);
    }, [onMount, editor.textViewRef]);

    return (
        <GtkScrolledWindow>
            <GtkTextView ref={editor.textViewRef}>
                <GtkTextBuffer onChanged={editor.onChanged}>{defaultCss}</GtkTextBuffer>
            </GtkTextView>
        </GtkScrolledWindow>
    );
};

const DEFAULT_CSS = "window { color: red; }";

const renderHost = async (defaultCss: string) => {
    const captured: { tv: Gtk.TextView | null } = { tv: null };
    await render(<Host defaultCss={defaultCss} onMount={(tv) => (captured.tv = tv)} />);
    return captured.tv;
};

describe("useCssEditor buffer", () => {
    it("populates the text buffer with the supplied default css", async () => {
        const textView = await renderHost(DEFAULT_CSS);
        expect(textView).not.toBeNull();
        if (!textView) return;
        const buffer = textView.getBuffer();
        const text = buffer.getText(buffer.getStartIter(), buffer.getEndIter(), false);
        expect(text).toBe(DEFAULT_CSS);
    });

    it("registers warning and error text tags on the buffer's tag table", async () => {
        const textView = await renderHost(DEFAULT_CSS);
        expect(textView).not.toBeNull();
        if (!textView) return;
        const tagTable = textView.getBuffer().getTagTable();
        expect(tagTable.lookup("error")).not.toBeNull();
        expect(tagTable.lookup("warning")).not.toBeNull();
    });
});

describe("useCssEditor lifecycle", () => {
    it("updates the css provider when the buffer text changes and applies error tags on invalid css", async () => {
        const textView = await renderHost(DEFAULT_CSS);
        expect(textView).not.toBeNull();
        if (!textView) return;
        const buffer = textView.getBuffer();
        await act(() => buffer.setText("window { color: not-a-real-value; }", -1));
        const text = buffer.getText(buffer.getStartIter(), buffer.getEndIter(), false);
        expect(text).toBe("window { color: not-a-real-value; }");
        const tagTable = buffer.getTagTable();
        expect(tagTable.lookup("error")).not.toBeNull();
    });
});
