import * as Gdk from "@gtkx/ffi/gdk";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkTextView } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef, useMemo } from "react";
import { describe, expect, it } from "vitest";

const getBufferText = (buffer: Gtk.TextBuffer): string => {
    const startIter = buffer.getStartIter();
    const endIter = buffer.getEndIter();
    return buffer.getText(startIter, endIter, true);
};

const usePaintable = (): Gdk.Paintable | null => {
    return useMemo(() => {
        const display = Gdk.Display.getDefault();
        if (!display) return null;
        const theme = Gtk.IconTheme.getForDisplay(display);
        const paintable = theme.lookupIcon(
            "image-x-generic-symbolic",
            16,
            1,
            Gtk.TextDirection.LTR,
            Gtk.IconLookupFlags.PRELOAD,
        );
        return paintable as unknown as Gdk.Paintable;
    }, []);
};

describe("render - TextPaintable", () => {
    it("inserts the inline paintable into the TextBuffer", async () => {
        const ref = createRef<Gtk.TextView>();

        const Harness = () => {
            const paintable = usePaintable();
            return (
                <GtkTextView ref={ref}>
                    Inline icon: {paintable ? <GtkTextView.Paintable paintable={paintable} /> : null}
                    {" end"}
                </GtkTextView>
            );
        };

        await render(<Harness />);

        const buffer = ref.current?.getBuffer();
        expect(buffer).toBeDefined();
        const text = getBufferText(buffer as Gtk.TextBuffer);
        expect(text).toContain("Inline icon:");
        expect(text).toContain("end");
    });

    it("renders surrounding text without the paintable child", async () => {
        const ref = createRef<Gtk.TextView>();

        await render(<GtkTextView ref={ref}>Plain text without paintable</GtkTextView>);

        const buffer = ref.current?.getBuffer();
        expect(getBufferText(buffer as Gtk.TextBuffer)).toContain("Plain text without paintable");
    });
});
