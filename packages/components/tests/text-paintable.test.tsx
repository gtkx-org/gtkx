import { TextPaintable } from "@gtkx/components";
import * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkTextBuffer, GtkTextTag, GtkTextView } from "@gtkx/jsx/gtk";
import { render, screen } from "@gtkx/testing";
import { createRef, type ReactNode, type Ref, type RefObject, useMemo } from "react";
import { describe, expect, it } from "vitest";

const getTextBuffer = (ref: RefObject<Gtk.TextView | null>): Gtk.TextBuffer =>
    ref.current?.getBuffer() as Gtk.TextBuffer;

const usePaintable = (icon = "image-x-generic-symbolic"): Gtk.IconPaintable | null => {
    return useMemo(() => {
        const display = Gdk.Display.getDefault();
        if (!display) return null;
        const theme = Gtk.IconTheme.getForDisplay(display);
        return theme.lookupIcon(icon, null, 16, 1, Gtk.TextDirection.LTR, Gtk.IconLookupFlags.PRELOAD);
    }, [icon]);
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

type InsertedCall = { buffer: Gtk.TextBuffer; mark: Gtk.TextMark };

const requireCall = (calls: InsertedCall[], index: number): InsertedCall => {
    const call = calls[index];
    if (!call) throw new Error(`Expected an onInserted call at index ${index}`);
    return call;
};

const buildReplaceable =
    (viewRef: Ref<Gtk.TextView | null>, calls: InsertedCall[]) =>
    (icon: string, show: boolean): ReactNode => (
        <ReplaceableHarness
            viewRef={viewRef}
            icon={icon}
            show={show}
            onInserted={(buffer, mark) => calls.push({ buffer, mark })}
        />
    );

const ReplaceableHarness = ({
    viewRef,
    icon,
    show,
    onInserted,
}: {
    viewRef: Ref<Gtk.TextView | null>;
    icon: string;
    show: boolean;
    onInserted: (buffer: Gtk.TextBuffer, mark: Gtk.TextMark) => void;
}) => {
    const paintable = usePaintable(icon);
    return (
        <GtkTextView
            ref={viewRef}
            buffer={
                <GtkTextBuffer>
                    {"before "}
                    {show && paintable ? <TextPaintable paintable={paintable} onInserted={onInserted} /> : null}
                    {" after"}
                </GtkTextBuffer>
            }
        />
    );
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

    it("fires onInserted with the buffer and a mark positioned at the paintable", async () => {
        const calls: InsertedCall[] = [];
        const build = buildReplaceable(createRef<Gtk.TextView>(), calls);

        await render(build("image-x-generic-symbolic", true));

        expect(calls).toHaveLength(1);
        const call = requireCall(calls, 0);
        expect(call.mark.getLeftGravity()).toBe(true);
        expect(call.buffer.getIterAtMark(call.mark).getPaintable()).toBeTruthy();
    });

    it("replaces the embedded paintable when the paintable prop changes", async () => {
        const viewRef = createRef<Gtk.TextView>();
        const calls: InsertedCall[] = [];
        const build = buildReplaceable(viewRef, calls);

        const { rerender } = await render(build("image-x-generic-symbolic", true));
        expect(calls).toHaveLength(1);
        expect(countPaintables(getTextBuffer(viewRef))).toBe(1);

        await rerender(build("folder-symbolic", true));

        expect(calls).toHaveLength(2);
        expect(countPaintables(getTextBuffer(viewRef))).toBe(1);
        const call = requireCall(calls, 1);
        expect(call.buffer.getIterAtMark(call.mark).getPaintable()).toBeTruthy();
    });

    it("deletes exactly the paintable on unmount, preserving surrounding text", async () => {
        const viewRef = createRef<Gtk.TextView>();
        const build = buildReplaceable(viewRef, []);

        const { rerender } = await render(build("image-x-generic-symbolic", true));
        expect(countPaintables(getTextBuffer(viewRef))).toBe(1);

        await rerender(build("image-x-generic-symbolic", false));

        const buffer = getTextBuffer(viewRef);
        expect(countPaintables(buffer)).toBe(0);
        expect(buffer.getText(buffer.getStartIter(), buffer.getEndIter(), true)).toBe("before  after");
    });
});
