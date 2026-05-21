import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it } from "vitest";
import { tabsDemo } from "../../../src/demos/input/tabs.js";
import { renderDemo } from "../../helpers/render-demo.js";

describe("tabsDemo", () => {
    it("exposes the expected metadata", () => {
        expect(tabsDemo.id).toBe("tabs");
        expect(tabsDemo.title).toBe("Text View/Tabs");
        expect(typeof tabsDemo.sourceCode).toBe("string");
        expect(tabsDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(tabsDemo.keywords).toContain("tabs");
        expect(tabsDemo.defaultWidth).toBe(330);
        expect(tabsDemo.defaultHeight).toBe(130);
        expect(tabsDemo.component).toBeTypeOf("function");
    });

    it("renders a GtkTextView populated with tab-separated rows", async () => {
        const { container } = await renderDemo(tabsDemo);
        const textView = findTextView(container);
        expect(textView).toBeInstanceOf(Gtk.TextView);
        const buffer = (textView as Gtk.TextView).getBuffer();
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
        const { container } = await renderDemo(tabsDemo);
        const textView = findTextView(container) as Gtk.TextView;
        const tabs = textView.getTabs();
        expect(tabs).not.toBeNull();
        if (tabs) {
            expect(tabs.getSize()).toBe(3);
        }
        expect(textView.getWrapMode()).toBe(Gtk.WrapMode.WORD);
    });

    it("wraps the text view in a scrolled window with the expected scrollbar policies", async () => {
        const { container } = await renderDemo(tabsDemo);
        const sw = findScrolledWindow(container) as Gtk.ScrolledWindow;
        expect(sw).toBeInstanceOf(Gtk.ScrolledWindow);
        const [hpolicy, vpolicy] = sw.getPolicy();
        expect(hpolicy).toBe(Gtk.PolicyType.NEVER);
        expect(vpolicy).toBe(Gtk.PolicyType.AUTOMATIC);
    });
});

const findTextView = (root: Gtk.Widget): Gtk.TextView | null => {
    let child: Gtk.Widget | null = root;
    const stack: Gtk.Widget[] = [root];
    while (stack.length > 0) {
        child = stack.pop() ?? null;
        if (!child) continue;
        if (child instanceof Gtk.TextView) return child;
        let next = child.getFirstChild();
        while (next) {
            stack.push(next);
            next = next.getNextSibling();
        }
    }
    return null;
};

const findScrolledWindow = (root: Gtk.Widget): Gtk.ScrolledWindow | null => {
    const stack: Gtk.Widget[] = [root];
    while (stack.length > 0) {
        const node = stack.pop();
        if (!node) continue;
        if (node instanceof Gtk.ScrolledWindow) return node;
        let next = node.getFirstChild();
        while (next) {
            stack.push(next);
            next = next.getNextSibling();
        }
    }
    return null;
};
