import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it } from "vitest";
import { tabsDemo } from "../../../src/demos/input/tabs.js";
import { renderDemo, screen } from "../../test-utils.js";

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
        expect(text).toContain("one");
        expect(text).toContain("2.0");
        expect(text).toContain("three");
        expect(text).toContain("seven");
        expect(text).toContain("88.88");
        expect(text).toContain("nine");
        expect(text).toContain("\t");
    });

    it("configures the text view tabs with the expected alignments", async () => {
        await renderDemo(tabsDemo);
        const textView = (await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX)) as Gtk.TextView;
        const tabs = textView.getTabs();
        expect(tabs).not.toBeNull();
        if (tabs) {
            expect(tabs.getSize()).toBe(3);
        }
        expect(textView.getWrapMode()).toBe(Gtk.WrapMode.WORD);
    });

    it("wraps the text view in a scrolled window with the expected scrollbar policies", async () => {
        await renderDemo(tabsDemo);
        const textView = (await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX)) as Gtk.TextView;
        const parent = textView.getParent();
        const sw = parent instanceof Gtk.ScrolledWindow ? parent : parent?.getParent();
        if (!(sw instanceof Gtk.ScrolledWindow)) throw new Error("expected enclosing scrolled window");
        const [hpolicy, vpolicy] = sw.getPolicy();
        expect(hpolicy).toBe(Gtk.PolicyType.NEVER);
        expect(vpolicy).toBe(Gtk.PolicyType.AUTOMATIC);
    });
});
