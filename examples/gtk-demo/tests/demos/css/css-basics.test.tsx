import * as Gtk from "@gtkx/gi/gtk";
import * as Pango from "@gtkx/gi/pango";
import { GtkTextBuffer, GtkTextView } from "@gtkx/jsx/gtk";
import { screen, userEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import type { Demo } from "../../../src/demos/types.js";
import { cssBasicsDemo } from "../../../src/demos/css/css-basics.js";
import { renderDemo } from "../../test-utils.js";

const CssProbe = () => (
    <GtkTextView
        accessibleLabel="Unstyled CSS probe"
        buffer={<GtkTextBuffer>Probe</GtkTextBuffer>}
    />
);

const cssProbeDemo: Demo = {
    id: "css-probe",
    title: "CSS Probe",
    description: "",
    keywords: [],
    component: CssProbe,
    windowCssClasses: ["demo"],
};

const renderTextView = async (): Promise<Gtk.TextView> => {
    await renderDemo(cssBasicsDemo);

    return await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX, { name: "CSS editor", as: Gtk.TextView });
};

const replaceCss = async (textView: Gtk.TextView, css: string): Promise<void> => {
    await userEvent.clear(textView);
    await userEvent.type(textView, css);
};

const hasUnderline = (textView: Gtk.TextView, underline: Pango.Underline): boolean => {
    const buffer = textView.getBuffer();
    const iter = buffer.getStartIter();

    do {
        if (iter.getTags().some((tag) => tag.underline === underline)) {
            return true;
        }
    } while (iter.forwardChar());

    return false;
};

const readColor = (widget: Gtk.Widget): [number, number, number] => {
    const color = widget.getColor();

    return [color.red, color.green, color.blue];
};

const isGreen = ([red, green, blue]: [number, number, number]): boolean => green > red && green > blue;

describe("cssBasicsDemo rendering", () => {
    it("renders a text view inside a scrolled window with the default CSS preloaded", async () => {
        const textView = await renderTextView();
        expect(textView).toHaveDisplayValue(/Set a very futuristic style by default/);
        expect(textView).toHaveDisplayValue(/window\.demo/);
        expect(textView).toHaveDisplayValue(/color: green/);
    });

    it("applies the demo css class to the host window", async () => {
        await renderDemo(cssBasicsDemo);
        const window = await screen.findByRole(Gtk.AccessibleRole.WINDOW, { as: Gtk.Window });
        expect(window).toHaveClass("demo");
    });
});

describe("cssBasicsDemo behavior", () => {
    it("applies edits in Strict Mode, reopens cleanly, and removes its styles on unmount", async () => {
        const baselineRender = await renderDemo(cssProbeDemo);
        const baselineProbe = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX, {
            name: "Unstyled CSS probe",
            as: Gtk.TextView,
        });
        const baselineColor = readColor(baselineProbe);
        await baselineRender.unmount();

        const styledRender = await renderDemo(cssBasicsDemo, { isReactStrictMode: true });
        const textView = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX, {
            name: "CSS editor",
            as: Gtk.TextView,
        });
        await waitFor(() => {
            expect(isGreen(readColor(textView))).toBe(true);
        });
        await replaceCss(textView, ".demo textview { color: rgb(255, 0, 0); }");
        await waitFor(() => {
            expect(readColor(textView)).toEqual([1, 0, 0]);
        });
        await styledRender.unmount();

        const reopenedRender = await renderDemo(cssBasicsDemo);
        const reopened = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX, {
            name: "CSS editor",
            as: Gtk.TextView,
        });
        await waitFor(() => {
            expect(isGreen(readColor(reopened))).toBe(true);
        });
        await reopenedRender.unmount();

        await renderDemo(cssProbeDemo);
        const cleanProbe = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX, {
            name: "Unstyled CSS probe",
            as: Gtk.TextView,
        });
        expect(readColor(cleanProbe)).toEqual(baselineColor);
    });

    it("renders error and warning underlines while CSS is edited", async () => {
        const textView = await renderTextView();
        await replaceCss(textView, "window { color: this-is-not-a-valid-color; }");

        await waitFor(() => {
            expect(hasUnderline(textView, Pango.Underline.ERROR)).toBe(true);
        });

        expect(hasUnderline(textView, Pango.Underline.SINGLE)).toBe(false);
        await replaceCss(textView, "window { color: green }");

        await waitFor(() => {
            expect(hasUnderline(textView, Pango.Underline.SINGLE)).toBe(true);
        });

        expect(hasUnderline(textView, Pango.Underline.ERROR)).toBe(false);
        await replaceCss(textView, "window { color: red; }");

        await waitFor(() => {
            expect(hasUnderline(textView, Pango.Underline.ERROR)).toBe(false);
        });

        expect(hasUnderline(textView, Pango.Underline.SINGLE)).toBe(false);
    });
});
