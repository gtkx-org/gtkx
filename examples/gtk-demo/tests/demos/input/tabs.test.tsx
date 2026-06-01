import * as Gtk from "@gtkx/gi/gtk";
import * as Pango from "@gtkx/gi/pango";
import { screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { tabsDemo } from "../../../src/demos/input/tabs.js";
import { renderDemo } from "../../test-utils.js";

describe("tabsDemo", () => {
    it("exposes the expected metadata", () => {
        expect(tabsDemo.id).toBe("tabs");
        expect(tabsDemo.title).toBe("Text View/Tabs");
        expect(tabsDemo.description.length).toBeGreaterThan(0);
        expect(Array.isArray(tabsDemo.keywords)).toBe(true);
        expect(typeof tabsDemo.sourceCode).toBe("string");
        expect(tabsDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(tabsDemo.defaultWidth).toBe(330);
        expect(tabsDemo.defaultHeight).toBe(130);
        expect(tabsDemo.component).toBeTypeOf("function");
    });

    it("renders a GtkTextView populated with tab-separated rows", async () => {
        await renderDemo(tabsDemo);
        const textView = (await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX)) as Gtk.TextView;
        expect(textView).toBeInstanceOf(Gtk.TextView);
        const buffer = textView.getBuffer();
        const text = buffer.getText(buffer.getStartIter(), buffer.getEndIter(), false);
        expect(text).toContain("one\t2.0\tthree");
        expect(text).toContain("four\t5.555\tsix");
        expect(text).toContain("seven\t88.88\tnine");
    });

    it("configures three tabs with LEFT, DECIMAL, RIGHT alignments", async () => {
        await renderDemo(tabsDemo);
        const textView = (await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX)) as Gtk.TextView;
        const tabs = textView.getTabs();
        expect(tabs).not.toBeNull();
        const tabArray = tabs as Pango.TabArray;
        expect(tabArray.getSize()).toBe(3);

        const [align0] = tabArray.getTab(0) as [Pango.TabAlign, number];
        const [align1] = tabArray.getTab(1) as [Pango.TabAlign, number];
        const [align2] = tabArray.getTab(2) as [Pango.TabAlign, number];
        expect(align0).toBe(Pango.TabAlign.LEFT);
        expect(align1).toBe(Pango.TabAlign.DECIMAL);
        expect(align2).toBe(Pango.TabAlign.RIGHT);
    });

    it("places the tabs at positions 0, 150 and 290 with '.' as the decimal point", async () => {
        await renderDemo(tabsDemo);
        const textView = (await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX)) as Gtk.TextView;
        const tabs = textView.getTabs() as Pango.TabArray;

        const [, pos0] = tabs.getTab(0) as [Pango.TabAlign, number];
        const [, pos1] = tabs.getTab(1) as [Pango.TabAlign, number];
        const [, pos2] = tabs.getTab(2) as [Pango.TabAlign, number];
        expect(pos0).toBe(0);
        expect(pos1).toBe(150);
        expect(pos2).toBe(290);

        expect(tabs.getDecimalPoint(1)).toBe(".");
    });

    it("uses word wrap on the text view", async () => {
        await renderDemo(tabsDemo);
        const textView = (await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX)) as Gtk.TextView;
        expect(textView.getWrapMode()).toBe(Gtk.WrapMode.WORD);
    });

    it("wraps the text view in a scrolled window with the expected scrollbar policies", async () => {
        await renderDemo(tabsDemo);
        const sw = (await screen.findByName("scrolled")) as Gtk.ScrolledWindow;
        const [hpolicy, vpolicy] = sw.getPolicy();
        expect(hpolicy).toBe(Gtk.PolicyType.NEVER);
        expect(vpolicy).toBe(Gtk.PolicyType.AUTOMATIC);
    });
});
