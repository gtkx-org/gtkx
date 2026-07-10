import type * as Gtk from "@gtkx/gi/gtk";
import { screen, waitFor, within } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { textscrollDemo } from "../../../src/demos/input/textscroll.js";
import { renderDemo } from "../../test-utils.js";

const findTextViews = async (): Promise<[Gtk.TextView, Gtk.TextView]> => {
    const end = (await screen.findByName("text-view-end")) as Gtk.TextView;
    const scroll = (await screen.findByName("text-view-scroll")) as Gtk.TextView;
    return [end, scroll];
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

    it("renders the scroll-to-end and scroll-to-bottom text views", async () => {
        await renderDemo(textscrollDemo);
        const [end, scroll] = await findTextViews();
        expect(end).toBeDefined();
        expect(scroll).toBeDefined();
    });

    it("creates the 'end' mark on the scroll-to-end view and 'scroll' on the scroll-to-bottom view", async () => {
        await renderDemo(textscrollDemo);
        const [end, scroll] = await findTextViews();
        await waitFor(() => {
            expect(end.getBuffer().getMark("end")).not.toBeNull();
            expect(scroll.getBuffer().getMark("scroll")).not.toBeNull();
        });
    });

    it("appends text to the buffers as scroll ticks run", async () => {
        await renderDemo(textscrollDemo);
        const [end, scroll] = await findTextViews();
        await waitFor(() => {
            for (const view of [end, scroll]) {
                expect(within(view).getByDisplayValue(/Scroll to end|Scroll to bottom/)).toBe(view);
            }
        });
    });
});
