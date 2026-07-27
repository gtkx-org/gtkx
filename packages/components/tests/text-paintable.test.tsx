import { TextPaintable } from "@gtkx/components";
import * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkTextBuffer, GtkTextTag, GtkTextView } from "@gtkx/jsx/gtk";
import { render, screen } from "@gtkx/testing";
import { createRef, type ReactElement, type ReactNode, type Ref, type RefObject, useMemo } from "react";
import { describe, expect, it } from "vitest";

type InsertedCall = { buffer: Gtk.TextBuffer; mark: Gtk.TextMark };

type ReplaceableFixture = {
    calls: InsertedCall[];
    rerender: (icon: string, isShown: boolean) => Promise<void>;
};

const getTextBuffer = (ref: RefObject<Gtk.TextView | null>): Gtk.TextBuffer =>
    ref.current?.getBuffer() as Gtk.TextBuffer;

const usePaintable = (icon = "image-x-generic-symbolic"): Gtk.IconPaintable | null => {
    return useMemo(() => {
        const display = Gdk.Display.getDefault();

        if (!display) {
            return null;
        }

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

const inlineIconContent = (paintable: Gtk.IconPaintable | null): ReactNode => (
    <>
        Inline icon:
        {" "}
        {paintable ? <TextPaintable paintable={paintable} /> : null}
        {" end"}
    </>
);

const taggedIconContent = (prefix: string, paintable: Gtk.IconPaintable | null): ReactNode => (
    <>
        {prefix}
        <GtkTextTag name="wrap">{paintable ? <TextPaintable paintable={paintable} /> : null}</GtkTextTag>
    </>
);

const taggedHarness = (viewRef: Ref<Gtk.TextView | null>, prefix: string): ReactElement => (
    <PaintableHarness viewRef={viewRef} content={(paintable) => taggedIconContent(prefix, paintable)} />
);

const countPaintables = (buffer: Gtk.TextBuffer): number => {
    const iter = buffer.getStartIter();
    let count = 0;

    do {
        if (iter.getPaintable()) {
            count++;
        }
    } while (iter.forwardChar());

    return count;
};

const requireCall = (calls: InsertedCall[], index: number): InsertedCall => {
    const call = calls[index];

    if (!call) {
        throw new Error(`Expected an onInserted call at index ${String(index)}`);
    }

    return call;
};

const ReplaceableHarness = ({
    viewRef,
    icon,
    isShown,
    onInserted,
}: {
    viewRef: Ref<Gtk.TextView | null>;
    icon: string;
    isShown: boolean;
    onInserted: (buffer: Gtk.TextBuffer, mark: Gtk.TextMark) => void;
}) => {
    const paintable = usePaintable(icon);

    return (
        <GtkTextView
            ref={viewRef}
            buffer={(
                <GtkTextBuffer>
                    {"before "}
                    {isShown && paintable ? <TextPaintable paintable={paintable} onInserted={onInserted} /> : null}
                    {" after"}
                </GtkTextBuffer>
            )}
        />
    );
};

const buildReplaceable =
    (viewRef: Ref<Gtk.TextView | null>, calls: InsertedCall[]) =>
        (icon: string, isShown: boolean): ReactNode => (
            <ReplaceableHarness
                viewRef={viewRef}
                icon={icon}
                isShown={isShown}
                onInserted={(buffer, mark) => {
                    calls.push({ buffer, mark });
                }}
            />
        );

const renderReplaceable = async (viewRef: Ref<Gtk.TextView | null>): Promise<ReplaceableFixture> => {
    const calls: InsertedCall[] = [];
    const build = buildReplaceable(viewRef, calls);
    const { rerender } = await render(build("image-x-generic-symbolic", true));

    return {
        calls,
        rerender: async (icon, isShown) => {
            await rerender(build(icon, isShown));
        },
    };
};

describe("render - TextPaintable", () => {
    it("inserts an inline paintable at a GtkTextMark", async () => {
        const viewRef = createRef<Gtk.TextView>();
        await render(<PaintableHarness viewRef={viewRef} content={inlineIconContent} />);
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
        const { rerender } = await render(taggedHarness(viewRef, "short"));
        expect(countPaintables(getTextBuffer(viewRef))).toBe(1);
        await rerender(taggedHarness(viewRef, "a much longer prefix"));
        expect(screen.getByDisplayValue(/a much longer prefix/)).toBeTruthy();
        expect(countPaintables(getTextBuffer(viewRef))).toBe(1);
    });

    it("fires onInserted with the buffer and a mark positioned at the paintable", async () => {
        const { calls } = await renderReplaceable(createRef<Gtk.TextView>());
        expect(calls).toHaveLength(1);
        const call = requireCall(calls, 0);
        expect(call.mark.getLeftGravity()).toBe(true);
        expect(call.buffer.getIterAtMark(call.mark).getPaintable()).toBeTruthy();
    });

    it("replaces the embedded paintable when the paintable prop changes", async () => {
        const viewRef = createRef<Gtk.TextView>();
        const { calls, rerender } = await renderReplaceable(viewRef);
        expect(calls).toHaveLength(1);
        expect(countPaintables(getTextBuffer(viewRef))).toBe(1);
        await rerender("folder-symbolic", true);
        expect(calls).toHaveLength(2);
        expect(countPaintables(getTextBuffer(viewRef))).toBe(1);
        const call = requireCall(calls, 1);
        expect(call.buffer.getIterAtMark(call.mark).getPaintable()).toBeTruthy();
    });

    it("deletes exactly the paintable on unmount, preserving surrounding text", async () => {
        const viewRef = createRef<Gtk.TextView>();
        const { rerender } = await renderReplaceable(viewRef);
        expect(countPaintables(getTextBuffer(viewRef))).toBe(1);
        await rerender("image-x-generic-symbolic", false);
        const buffer = getTextBuffer(viewRef);
        expect(countPaintables(buffer)).toBe(0);
        expect(buffer.getText(buffer.getStartIter(), buffer.getEndIter(), true)).toBe("before  after");
    });
});
