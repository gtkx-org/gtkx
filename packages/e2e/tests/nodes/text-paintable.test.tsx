import { TextPaintable } from "@gtkx/components";
import * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkTextBuffer, GtkTextTag, GtkTextView } from "@gtkx/jsx/gtk";
import { render, screen } from "@gtkx/testing";
import { createRef, type ReactNode, type Ref, useMemo } from "react";
import { describe, expect, it } from "vitest";
import { getTextBuffer } from "../helpers/buffer-text.js";

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

const PaintableHarness = ({
    viewRef,
    content,
}: {
    viewRef: Ref<Gtk.TextView | null>;
    content: (paintable: Gtk.IconPaintable | null) => ReactNode;
}) => {
    const paintable = usePaintable();
    return <GtkTextView ref={viewRef} buffer={<GtkTextBuffer>{content(paintable)}</GtkTextBuffer>} />;
};

const countPaintables = (buffer: Gtk.TextBuffer): number => {
    const iter = buffer.getStartIter();
    let count = 0;
    do {
        if (iter.getPaintable()) count++;
    } while (iter.forwardChar());
    return count;
};

describe("render - TextPaintable", () => {
    it("inserts an inline paintable at a GtkTextMark", async () => {
        const viewRef = createRef<Gtk.TextView>();
        await render(
            <PaintableHarness
                viewRef={viewRef}
                content={(paintable) => (
                    <>
                        Inline icon: {paintable ? <TextPaintable paintable={paintable} /> : null}
                        {" end"}
                    </>
                )}
            />,
        );

        expect(screen.getByDisplayValue(/Inline icon:/)).toBeTruthy();
        expect(screen.getByDisplayValue(/end/)).toBeTruthy();
        expect(countPaintables(getTextBuffer(viewRef))).toBe(1);
    });

    it("renders surrounding text without the paintable child", async () => {
        await render(<GtkTextView buffer={<GtkTextBuffer>Plain text without paintable</GtkTextBuffer>} />);

        expect(screen.getByDisplayValue(/Plain text without paintable/)).toBeTruthy();
    });

    it("keeps a paintable inside a tag across sibling text updates", async () => {
        const viewRef = createRef<Gtk.TextView>();
        const buildHarness = (prefix: string) => (
            <PaintableHarness
                viewRef={viewRef}
                content={(paintable) => (
                    <>
                        {prefix}
                        <GtkTextTag name="wrap">
                            {paintable ? <TextPaintable paintable={paintable} /> : null}
                        </GtkTextTag>
                    </>
                )}
            />
        );

        const { rerender } = await render(buildHarness("short"));
        expect(countPaintables(getTextBuffer(viewRef))).toBe(1);

        await rerender(buildHarness("a much longer prefix"));
        expect(screen.getByDisplayValue(/a much longer prefix/)).toBeTruthy();
        expect(countPaintables(getTextBuffer(viewRef))).toBe(1);
    });
});
