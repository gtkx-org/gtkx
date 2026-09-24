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

const enclosingScrolledWindow = (view: Gtk.TextView): Gtk.ScrolledWindow => {
    let current = view.getParent();

    while (current !== null) {
        if (current instanceof Gtk.ScrolledWindow) {
            return current;
        }

        current = current.getParent();
    }

    throw new Error("Text view is not inside a scrolled window");
};

const lastVisibleLine = (view: Gtk.TextView): number => {
    const visible = view.getVisibleRect();
    const [iter] = view.getLineAtY(visible.y + visible.height - 1);

    return iter.getLine();
};

describe("textscrollDemo", () => {
    it("renders each named view with its own distinct appended text", async () => {
        await renderDemo(textscrollDemo);
        const [end, scroll] = await findTextViews();
        expect(end).toHaveAccessibleName("Scroll to end");
        expect(scroll).toHaveAccessibleName("Scroll to bottom");

        await waitFor(() => {
            expect(within(end).getByDisplayValue(/Scroll to end/)).toBe(end);
            expect(within(scroll).getByDisplayValue(/Scroll to bottom/)).toBe(scroll);
        });

        expect(within(end).queryByDisplayValue(/Scroll to bottom/)).toBeNull();
        expect(within(scroll).queryByDisplayValue(/Scroll to end/)).toBeNull();
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

    it("keeps each advancing last line inside the visible scroll range", async () => {
        await renderDemo(textscrollDemo);
        const [end, scroll] = await findTextViews();
        const root = end.getRoot();

        if (!(root instanceof Gtk.Window)) {
            throw new TypeError("Text view is not inside a window");
        }

        root.setDefaultSize(600, 120);

        await waitFor(() => {
            expect(end.getHeight()).toBeLessThan(200);
        });

        const endAdjustment = enclosingScrolledWindow(end).getVadjustment();
        const scrollAdjustment = enclosingScrolledWindow(scroll).getVadjustment();

        await waitFor(
            () => {
                expect(lastVisibleLine(end)).toBe(end.getBuffer().getLineCount() - 1);
                expect(lastVisibleLine(scroll)).toBe(scroll.getBuffer().getLineCount() - 1);
                expect(endAdjustment.getValue()).toBeGreaterThan(0);
                expect(scrollAdjustment.getValue()).toBeGreaterThan(0);
            },
            { timeout: 2000 },
        );
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
