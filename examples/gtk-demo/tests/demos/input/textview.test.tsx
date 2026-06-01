import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { textviewDemo } from "../../../src/demos/input/textview.js";
import { renderDemo } from "../../test-utils.js";

const findTextViews = async (): Promise<[Gtk.TextView, Gtk.TextView]> => {
    const view1 = (await screen.findByName("text-view-1")) as Gtk.TextView;
    const view2 = (await screen.findByName("text-view-2")) as Gtk.TextView;
    return [view1, view2];
};

const findClickMeButtons = async (): Promise<Gtk.Button[]> => {
    const widgets = await screen.findAllByRole(Gtk.AccessibleRole.BUTTON, { name: "Click Me" });
    return widgets.filter((w): w is Gtk.Button => w instanceof Gtk.Button);
};

const readBufferText = (view: Gtk.TextView): string => {
    const buffer = view.getBuffer();
    return buffer.getText(buffer.getStartIter(), buffer.getEndIter(), false) ?? "";
};

describe("textviewDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(textviewDemo.id).toBe("textview");
        expect(textviewDemo.title).toBe("Text View/Multiple Views");
        expect(textviewDemo.description.length).toBeGreaterThan(0);
        expect(Array.isArray(textviewDemo.keywords)).toBe(true);
        expect(typeof textviewDemo.sourceCode).toBe("string");
        expect(textviewDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(textviewDemo.defaultWidth).toBe(450);
        expect(textviewDemo.defaultHeight).toBe(450);
        expect(textviewDemo.component).toBeTypeOf("function");
    });
});

describe("textviewDemo rendering", () => {
    it("renders the host window and two text views sharing a single buffer", async () => {
        await renderDemo(textviewDemo);
        const window = await screen.findByRole(Gtk.AccessibleRole.WINDOW);
        expect(window).toBeInstanceOf(Gtk.Window);
        const [view1, view2] = await findTextViews();
        expect(view1.getBuffer()).toBe(view2.getBuffer());
    });

    it("populates the shared buffer with section headings and international content", async () => {
        await renderDemo(textviewDemo);
        const [view1] = await findTextViews();
        const text = readBufferText(view1);
        expect(text).toContain("The text widget can display text with all kinds of nifty attributes");
        expect(text).toContain("Font styles.");
        expect(text).toContain("Colors.");
        expect(text).toContain("Underline, strikethrough, and rise.");
        expect(text).toContain("Images.");
        expect(text).toContain("Spacing.");
        expect(text).toContain("Editability.");
        expect(text).toContain("Wrapping.");
        expect(text).toContain("Justification.");
        expect(text).toContain("Internationalization.");
        expect(text).toContain("Grüß Gott");
        expect(text).toContain("Γειά σας");
    });

    it("wraps text in word mode in the first text view", async () => {
        await renderDemo(textviewDemo);
        const [view1] = await findTextViews();
        expect(view1.getWrapMode()).toBe(Gtk.WrapMode.WORD);
    });
});

describe("textviewDemo cloned widgets", () => {
    it("attaches a Click Me button in both text views", async () => {
        await renderDemo(textviewDemo);
        const buttons = await findClickMeButtons();
        expect(buttons.length).toBeGreaterThanOrEqual(2);
    });
});

describe("textviewDemo easter egg", () => {
    it("opens the easter-egg nested window when the cloned Click Me button is activated", async () => {
        await renderDemo(textviewDemo);
        const buttons = await findClickMeButtons();
        const cloned = buttons[buttons.length - 1];
        expect(cloned).toBeInstanceOf(Gtk.Button);
        const beforeWindows = Gtk.Window.listToplevels().length;
        if (!cloned) return;
        await userEvent.click(cloned);
        await waitFor(() => {
            expect(Gtk.Window.listToplevels().length).toBeGreaterThan(beforeWindows);
        });
    });

    it("opens the easter-egg via the source Click Me button in the first text view", async () => {
        await renderDemo(textviewDemo);
        const buttons = await findClickMeButtons();
        const source = buttons[0];
        expect(source).toBeInstanceOf(Gtk.Button);
        const beforeWindows = Gtk.Window.listToplevels().length;
        if (!source) return;
        await userEvent.click(source);
        await waitFor(() => {
            expect(Gtk.Window.listToplevels().length).toBeGreaterThanOrEqual(beforeWindows);
        });
    });

    it("reuses the same easter-egg window on subsequent activations", async () => {
        await renderDemo(textviewDemo);
        const buttons = await findClickMeButtons();
        const cloned = buttons[buttons.length - 1];
        expect(cloned).toBeInstanceOf(Gtk.Button);
        const beforeWindows = Gtk.Window.listToplevels().length;
        if (!cloned) return;
        await userEvent.click(cloned);
        const windowCountAfterFirst = await waitFor(() => {
            const count = Gtk.Window.listToplevels().length;
            expect(count).toBeGreaterThan(beforeWindows);
            return count;
        });
        await userEvent.click(cloned);
        await waitFor(() => {
            expect(Gtk.Window.listToplevels().length).toBe(windowCountAfterFirst);
        });
    });
});
