import * as Gtk from "@gtkx/gi/gtk";
import { screen, waitFor, within } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { textscrollDemo } from "../../../src/demos/input/textscroll.js";
import { renderDemo } from "../../test-utils.js";

const findTextViews = async (): Promise<[Gtk.TextView, Gtk.TextView]> => {
    const end = await screen.findByName("text-view-end", { as: Gtk.TextView });
    const scroll = await screen.findByName("text-view-scroll", { as: Gtk.TextView });

    return [end, scroll];
};

const scrollMarkLine = (view: Gtk.TextView, markName: string): { line: number; lineOffset: number } => {
    const buffer = view.getBuffer();
    const mark = buffer.getMark(markName);

    if (!mark) {
        throw new Error(`mark ${markName} not found`);
    }

    const iter = buffer.getIterAtMark(mark);

    return { line: iter.getLine(), lineOffset: iter.getLineOffset() };
};

describe("textscrollDemo", () => {
    it("exposes the expected metadata", () => {
        expect(textscrollDemo.id).toBe("textscroll");
        expect(textscrollDemo.title).toBe("Text View/Automatic Scrolling");
        expect(textscrollDemo.description.length).toBeGreaterThan(0);
        expect(Array.isArray(textscrollDemo.keywords)).toBe(true);
        expect(typeof textscrollDemo.sourceCode).toBe("string");
        expect(textscrollDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(textscrollDemo.defaultWidth).toBe(600);
        expect(textscrollDemo.defaultHeight).toBe(400);
        expect(textscrollDemo.component).toBeTypeOf("function");
    });

    it("renders each named view with its own distinct appended text", async () => {
        await renderDemo(textscrollDemo);
        const [end, scroll] = await findTextViews();

        await waitFor(() => {
            expect(within(end).getByDisplayValue(/Scroll to end/)).toBe(end);
            expect(within(scroll).getByDisplayValue(/Scroll to bottom/)).toBe(scroll);
        });

        expect(within(end).queryByDisplayValue(/Scroll to bottom/)).toBeNull();
        expect(within(scroll).queryByDisplayValue(/Scroll to end/)).toBeNull();
    });

    it("creates the 'end' mark on the scroll-to-end view and 'scroll' on the scroll-to-bottom view", async () => {
        await renderDemo(textscrollDemo);
        const [end, scroll] = await findTextViews();

        await waitFor(() => {
            expect(end.getBuffer().getMark("end")).not.toBeNull();
            expect(scroll.getBuffer().getMark("scroll")).not.toBeNull();
        });
    });
});

describe("textscrollDemo scrolling", () => {
    it("grows both buffers as scroll ticks run", async () => {
        await renderDemo(textscrollDemo);
        const [end, scroll] = await findTextViews();
        const endStart = end.getBuffer().getLineCount();
        const scrollStart = scroll.getBuffer().getLineCount();

        await waitFor(() => {
            expect(end.getBuffer().getLineCount()).toBeGreaterThan(endStart);
            expect(scroll.getBuffer().getLineCount()).toBeGreaterThan(scrollStart);
        });
    });

    it("repositions the scroll-to-bottom 'scroll' mark to the start of the advancing last line each tick", async () => {
        await renderDemo(textscrollDemo);
        const [, scroll] = await findTextViews();

        await waitFor(() => {
            expect(scroll.getBuffer().getLineCount()).toBeGreaterThan(3);
        });

        const first = scrollMarkLine(scroll, "scroll");
        expect(first.lineOffset).toBe(0);
        expect(first.line).toBe(scroll.getBuffer().getLineCount() - 1);

        await waitFor(() => {
            expect(scrollMarkLine(scroll, "scroll").line).toBeGreaterThan(first.line);
        });

        const later = scrollMarkLine(scroll, "scroll");
        expect(later.lineOffset).toBe(0);
        expect(later.line).toBe(scroll.getBuffer().getLineCount() - 1);
    });

    it("stops appending to the buffer after the demo unmounts and clears its interval", async () => {
        const { unmount } = await renderDemo(textscrollDemo);
        const [end] = await findTextViews();
        const buffer = end.getBuffer();

        await waitFor(() => {
            expect(buffer.getLineCount()).toBeGreaterThan(3);
        });

        await unmount();
        const settled = buffer.getLineCount();
        await new Promise((resolve) => setTimeout(resolve, 300));
        expect(buffer.getLineCount()).toBe(settled);
    });
});
