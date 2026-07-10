import * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkTextBuffer, GtkTextPaintable, GtkTextView } from "@gtkx/jsx/gtk";
import { render, screen } from "@gtkx/testing";
import { useMemo } from "react";
import { describe, expect, it } from "vitest";

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
        const Harness = () => {
            const paintable = usePaintable();
            return (
                <GtkTextView
                    buffer={
                        <GtkTextBuffer>
                            Inline icon: {paintable ? <GtkTextPaintable paintable={paintable} /> : null}
                            {" end"}
                        </GtkTextBuffer>
                    }
                />
            );
        };

        await render(<Harness />);

        expect(screen.getByDisplayValue(/Inline icon:/)).toBeTruthy();
        expect(screen.getByDisplayValue(/end/)).toBeTruthy();
    });

    it("renders surrounding text without the paintable child", async () => {
        await render(<GtkTextView buffer={<GtkTextBuffer>Plain text without paintable</GtkTextBuffer>} />);

        expect(screen.getByDisplayValue(/Plain text without paintable/)).toBeTruthy();
    });
});
