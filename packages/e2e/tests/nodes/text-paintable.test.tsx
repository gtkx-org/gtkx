import * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkTextBuffer, GtkTextPaintable, GtkTextView } from "@gtkx/jsx/gtk";
import { render } from "@gtkx/testing";
import { createRef, useMemo } from "react";
import { describe, expect, it } from "vitest";
import { getBufferText } from "../helpers/buffer-text.js";

const usePaintable = (): Gtk.IconPaintable | null => {
    return useMemo(() => {
        const display = Gdk.Display.getDefault();
        if (!display) return null;
        const theme = Gtk.IconTheme.getForDisplay(display);
        return theme.lookupIcon(
            "image-x-generic-symbolic",
            null,
            16,
            1,
            Gtk.TextDirection.LTR,
            Gtk.IconLookupFlags.PRELOAD,
        );
    }, []);
};

describe("render - TextPaintable", () => {
    it("inserts the inline paintable into the TextBuffer", async () => {
        const ref = createRef<Gtk.TextView>();

        const Harness = () => {
            const paintable = usePaintable();
            return (
                <GtkTextView ref={ref}>
                    <GtkTextBuffer>
                        Inline icon: {paintable ? <GtkTextPaintable paintable={paintable} /> : null}
                        {" end"}
                    </GtkTextBuffer>
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

        await render(
            <GtkTextView ref={ref}>
                <GtkTextBuffer>Plain text without paintable</GtkTextBuffer>
            </GtkTextView>,
        );

        const buffer = ref.current?.getBuffer();
        expect(getBufferText(buffer as Gtk.TextBuffer)).toContain("Plain text without paintable");
    });
});
