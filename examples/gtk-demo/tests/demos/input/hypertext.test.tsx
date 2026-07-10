import * as Gtk from "@gtkx/gi/gtk";
import { act, screen, userEvent } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { hypertextDemo } from "../../../src/demos/input/hypertext.js";
import { readBufferText, renderDemo } from "../../test-utils.js";

const findTextView = async (): Promise<Gtk.TextView> =>
    (await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX)) as Gtk.TextView;

describe("hypertextDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(hypertextDemo.id).toBe("hypertext");
        expect(hypertextDemo.title).toBe("Text View/Hypertext");
        expect(hypertextDemo.description.length).toBeGreaterThan(0);
        expect(Array.isArray(hypertextDemo.keywords)).toBe(true);
        expect(typeof hypertextDemo.sourceCode).toBe("string");
        expect(hypertextDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(hypertextDemo.defaultWidth).toBe(330);
        expect(hypertextDemo.defaultHeight).toBe(330);
        expect(hypertextDemo.component).toBeTypeOf("function");
    });
});

describe("hypertextDemo rendering", () => {
    it("renders page 1 with the hypertext and tags introduction", async () => {
        await renderDemo(hypertextDemo);
        const textView = await findTextView();
        expect(textView).toBeInstanceOf(Gtk.TextView);
        expect(textView.getWrapMode()).toBe(Gtk.WrapMode.WORD);
        expect(textView.getBuffer().getEnableUndo()).toBe(true);
        expect(screen.getByDisplayValue(/simple /)).toBe(textView);
        expect(screen.getByDisplayValue(/hypertext/)).toBe(textView);
        expect(screen.getByDisplayValue(/can easily be realized with /)).toBe(textView);
        expect(screen.getByDisplayValue(/tags/)).toBe(textView);
    });
});

describe("hypertextDemo link navigation", () => {
    it("navigates to the tags definition page when Enter is pressed at the tags link", async () => {
        await renderDemo(hypertextDemo);
        const textView = await findTextView();
        const buffer = textView.getBuffer();
        const tagsOffset = readBufferText(textView).indexOf("tags");
        expect(tagsOffset).toBeGreaterThan(0);
        await act(() => buffer.placeCursor(buffer.getIterAtOffset(tagsOffset)));
        await userEvent.keyboard(textView, "{Enter}");
        await screen.findByDisplayValue(/attribute that can be applied to some range of text/);
    });

    it("navigates to the hypertext definition page when Enter is pressed at the hypertext link", async () => {
        await renderDemo(hypertextDemo);
        const textView = await findTextView();
        const buffer = textView.getBuffer();
        const linkOffset = readBufferText(textView).indexOf("hypertext");
        expect(linkOffset).toBeGreaterThan(0);
        await act(() => buffer.placeCursor(buffer.getIterAtOffset(linkOffset)));
        await userEvent.keyboard(textView, "{Enter}");
        await screen.findByDisplayValue(/Machine-readable text that is not sequential/);
    });
});

describe("hypertextDemo round trip", () => {
    it("navigates from page 2 (tags) back to page 1 via the Go back link", async () => {
        await renderDemo(hypertextDemo);
        const textView = await findTextView();
        const buffer = textView.getBuffer();
        const tagsOffset = readBufferText(textView).indexOf("tags");
        await act(() => buffer.placeCursor(buffer.getIterAtOffset(tagsOffset)));
        await userEvent.keyboard(textView, "{Enter}");
        await screen.findByDisplayValue(/attribute that can be applied/);
        const pageTwo = readBufferText(textView);
        const backOffset = pageTwo.indexOf("Go back");
        expect(backOffset).toBeGreaterThanOrEqual(0);
        const bufferAfter = textView.getBuffer();
        await act(() => bufferAfter.placeCursor(bufferAfter.getIterAtOffset(backOffset + 1)));
        await userEvent.keyboard(textView, "{Enter}");
        await screen.findByDisplayValue(/can easily be realized with |Some text to show/);
    });
});

describe("hypertextDemo input edge cases", () => {
    it("ignores non-Enter key presses without changing the page", async () => {
        await renderDemo(hypertextDemo);
        const textView = await findTextView();
        await userEvent.keyboard(textView, "a");
        expect(screen.getByDisplayValue(/Some text to show/)).toBe(textView);
        expect(screen.queryByDisplayValue(/attribute that can be applied/)).toBeNull();
    });

    it("does not navigate via Enter when the cursor is not on a link", async () => {
        await renderDemo(hypertextDemo);
        const textView = await findTextView();
        const buffer = textView.getBuffer();
        await act(() => buffer.placeCursor(buffer.getStartIter()));
        await userEvent.keyboard(textView, "{Enter}");
        expect(screen.getByDisplayValue(/Some text to show/)).toBe(textView);
        expect(screen.queryByDisplayValue(/attribute that can be applied/)).toBeNull();
    });

    it("invokes the hover handler on the text view without throwing", async () => {
        await renderDemo(hypertextDemo);
        const textView = await findTextView();
        await userEvent.hover(textView);
        await userEvent.unhover(textView);
        expect(screen.getByDisplayValue(/hypertext/)).toBe(textView);
    });

    it("invokes the click handler without changing the current page", async () => {
        await renderDemo(hypertextDemo);
        const textView = await findTextView();
        await userEvent.pointer(textView, "click");
        expect(screen.getByDisplayValue(/hypertext/)).toBe(textView);
        expect(screen.queryByDisplayValue(/attribute that can be applied/)).toBeNull();
    });
});
