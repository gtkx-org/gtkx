import * as Gtk from "@gtkx/gi/gtk";
import * as Pango from "@gtkx/gi/pango";
import { screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { tabsDemo } from "../../../src/demos/input/tabs.js";
import { renderDemo } from "../../test-utils.js";

const renderTextView = async (): Promise<Gtk.TextView> => {
    await renderDemo(tabsDemo);

    return await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX, { as: Gtk.TextView });
};

describe("tabsDemo", () => {
    it("renders a GtkTextView populated with tab-separated rows", async () => {
        const textView = await renderTextView();
        expect(await screen.findByDisplayValue(/one\t2\.0\tthree/, { collapseWhitespace: false })).toBe(textView);
        expect(await screen.findByDisplayValue(/four\t5\.555\tsix/, { collapseWhitespace: false })).toBe(textView);
        expect(await screen.findByDisplayValue(/seven\t88\.88\tnine/, { collapseWhitespace: false })).toBe(textView);
    });

    it("configures three tabs with LEFT, DECIMAL, RIGHT alignments", async () => {
        const textView = await renderTextView();
        const tabs = textView.getTabs();
        expect(tabs).not.toBeNull();
        const tabArray = tabs as Pango.TabArray;
        expect(tabArray.getSize()).toBe(3);
        const [align0] = tabArray.getTab(0);
        const [align1] = tabArray.getTab(1);
        const [align2] = tabArray.getTab(2);
        expect(align0).toBe(Pango.TabAlign.LEFT);
        expect(align1).toBe(Pango.TabAlign.DECIMAL);
        expect(align2).toBe(Pango.TabAlign.RIGHT);
    });
});

describe("tabsDemo text view", () => {
    it("places the tabs at positions 0, 150 and 290 with '.' as the decimal point", async () => {
        const textView = await renderTextView();
        const tabs = textView.getTabs() as Pango.TabArray;
        const [, pos0] = tabs.getTab(0);
        const [, pos1] = tabs.getTab(1);
        const [, pos2] = tabs.getTab(2);
        expect(pos0).toBe(0);
        expect(pos1).toBe(150);
        expect(pos2).toBe(290);
        expect(tabs.getDecimalPoint(1)).toBe(".");
    });

    it("uses word wrap on the text view", async () => {
        const textView = await renderTextView();
        expect(textView).toHaveObjectProperty("wrapMode", Gtk.WrapMode.WORD);
    });

    it("wraps the text view in a scrolled window with the expected scrollbar policies", async () => {
        await renderDemo(tabsDemo);
        const sw = await screen.findByName("scrolled", { as: Gtk.ScrolledWindow });
        const [hpolicy, vpolicy] = sw.getPolicy();
        expect(hpolicy).toBe(Gtk.PolicyType.NEVER);
        expect(vpolicy).toBe(Gtk.PolicyType.AUTOMATIC);
    });
});
