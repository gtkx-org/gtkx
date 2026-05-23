import * as Gtk from "@gtkx/ffi/gtk";
import { GtkScrolledWindow, GtkTextView } from "@gtkx/react";
import { type RefObject, useEffect, useRef } from "react";
import { describe, expect, it } from "vitest";
import { useCssEditor } from "../../../src/demos/css/use-css-editor.js";
import { render } from "../../test-utils.js";

interface HostProps {
    classes: string[];
    defaultCss: string;
    onMount?: (win: Gtk.Window | null, tv: Gtk.TextView | null) => void;
}

const Host = ({ classes, defaultCss, onMount }: HostProps) => {
    const windowRef = useRef<Gtk.Window | null>(null);
    if (!windowRef.current) windowRef.current = new Gtk.Window();

    const editor = useCssEditor(windowRef as RefObject<Gtk.Window | null>, classes, defaultCss);

    useEffect(() => {
        onMount?.(windowRef.current, editor.textViewRef.current);
        return () => {
            const win = windowRef.current;
            if (win) win.destroy();
            windowRef.current = null;
        };
    }, [onMount, editor.textViewRef]);

    return (
        <GtkScrolledWindow>
            <GtkTextView ref={editor.textViewRef} onBufferChanged={editor.onBufferChanged} />
        </GtkScrolledWindow>
    );
};

const DEFAULT_CSS = "window { color: red; }";

describe("useCssEditor buffer", () => {
    it("populates the text buffer with the supplied default css", async () => {
        const captured: { win: Gtk.Window | null; tv: Gtk.TextView | null } = { win: null, tv: null };
        await render(
            <Host
                classes={["sample"]}
                defaultCss={DEFAULT_CSS}
                onMount={(win, tv) => {
                    captured.win = win;
                    captured.tv = tv;
                }}
            />,
        );
        expect(captured.tv).not.toBeNull();
        if (!captured.tv) return;
        const buffer = captured.tv.getBuffer();
        const text = buffer.getText(buffer.getStartIter(), buffer.getEndIter(), false);
        expect(text).toBe(DEFAULT_CSS);
    });

    it("registers warning and error text tags on the buffer's tag table", async () => {
        const captured: { tv: Gtk.TextView | null } = { tv: null };
        await render(<Host classes={["tagged"]} defaultCss={DEFAULT_CSS} onMount={(_, tv) => (captured.tv = tv)} />);
        const textView = captured.tv;
        expect(textView).not.toBeNull();
        if (!textView) return;
        const tagTable = textView.getBuffer().getTagTable();
        expect(tagTable.lookup("error")).not.toBeNull();
        expect(tagTable.lookup("warning")).not.toBeNull();
    });
});

describe("useCssEditor lifecycle", () => {
    it("adds and removes the supplied window classes on mount and unmount", async () => {
        const captured: { win: Gtk.Window | null } = { win: null };
        const { unmount } = await render(
            <Host classes={["alpha", "beta"]} defaultCss={DEFAULT_CSS} onMount={(win) => (captured.win = win)} />,
        );
        const win = captured.win;
        expect(win).not.toBeNull();
        if (!win) return;
        expect(win.hasCssClass("alpha")).toBe(true);
        expect(win.hasCssClass("beta")).toBe(true);
        await unmount();
        expect(win.hasCssClass("alpha")).toBe(false);
        expect(win.hasCssClass("beta")).toBe(false);
    });

    it("updates the css provider when the buffer text changes and applies error tags on invalid css", async () => {
        const captured: { tv: Gtk.TextView | null } = { tv: null };
        await render(<Host classes={["live"]} defaultCss={DEFAULT_CSS} onMount={(_, tv) => (captured.tv = tv)} />);
        const textView = captured.tv;
        expect(textView).not.toBeNull();
        if (!textView) return;
        const buffer = textView.getBuffer();
        buffer.setText("window { color: not-a-real-value; }", -1);
        const text = buffer.getText(buffer.getStartIter(), buffer.getEndIter(), false);
        expect(text).toBe("window { color: not-a-real-value; }");
        const tagTable = buffer.getTagTable();
        expect(tagTable.lookup("error")).not.toBeNull();
    });
});
