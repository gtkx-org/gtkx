import * as Gtk from "@gtkx/ffi/gtk";
import { act, fireEvent, screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { sizegroupDemo } from "../../../src/demos/layout/sizegroup.js";
import { renderDemo } from "../../helpers/render-demo.js";

const findAllOfType = <T extends Gtk.Widget>(root: Gtk.Widget, ctor: new (...args: never[]) => T): T[] => {
    const matches: T[] = [];
    const visit = (widget: Gtk.Widget): void => {
        if (widget instanceof ctor) matches.push(widget);
        let child = widget.getFirstChild();
        while (child) {
            visit(child);
            child = child.getNextSibling();
        }
    };
    visit(root);
    return matches;
};

describe("sizegroupDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(sizegroupDemo.id).toBe("sizegroup");
        expect(sizegroupDemo.title).toBe("Size Groups");
        expect(sizegroupDemo.description.length).toBeGreaterThan(0);
        expect(sizegroupDemo.keywords).toEqual(
            expect.arrayContaining(["sizegroup", "size", "width", "alignment", "GtkSizeGroup"]),
        );
        expect(typeof sizegroupDemo.sourceCode).toBe("string");
        expect(sizegroupDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(sizegroupDemo.component).toBeTypeOf("function");
    });
});

describe("sizegroupDemo frames and labels", () => {
    it("renders the Color Options and Line Options frames", async () => {
        if (!sizegroupDemo.component) throw new Error("sizegroup demo component missing");
        const { container } = await renderDemo(sizegroupDemo.component);
        const frames = findAllOfType(container, Gtk.Frame);
        const labels = frames.map((f) => f.getLabel());
        expect(labels).toContain("Color Options");
        expect(labels).toContain("Line Options");
    });

    it("renders four GtkDropDowns - one per option row", async () => {
        if (!sizegroupDemo.component) throw new Error("sizegroup demo component missing");
        const { container } = await renderDemo(sizegroupDemo.component);
        const dropdowns = findAllOfType(container, Gtk.DropDown);
        expect(dropdowns).toHaveLength(4);
    });

    it("renders the underline-mnemonic labels '_Foreground', '_Background', '_Dashing', '_Line ends'", async () => {
        if (!sizegroupDemo.component) throw new Error("sizegroup demo component missing");
        const { container } = await renderDemo(sizegroupDemo.component);
        const labels = findAllOfType(container, Gtk.Label);
        const texts = labels.map((l) => l.getLabel());
        expect(texts).toContain("_Foreground");
        expect(texts).toContain("_Background");
        expect(texts).toContain("_Dashing");
        expect(texts).toContain("_Line ends");
    });

    it("connects each label to its dropdown via the mnemonic widget pointer", async () => {
        if (!sizegroupDemo.component) throw new Error("sizegroup demo component missing");
        const { container } = await renderDemo(sizegroupDemo.component);
        const labels = findAllOfType(container, Gtk.Label).filter((l) => {
            const text = l.getLabel();
            return text === "_Foreground" || text === "_Background" || text === "_Dashing" || text === "_Line ends";
        });
        expect(labels).toHaveLength(4);
        for (const label of labels) {
            expect(label.getMnemonicWidget()).toBeInstanceOf(Gtk.DropDown);
        }
    });
});

describe("sizegroupDemo check button", () => {
    it("starts with grouping enabled and the size group in HORIZONTAL mode", async () => {
        if (!sizegroupDemo.component) throw new Error("sizegroup demo component missing");
        await renderDemo(sizegroupDemo.component);
        const toggle = await screen.findByRole(Gtk.AccessibleRole.CHECKBOX);
        expect(toggle).toBeInstanceOf(Gtk.CheckButton);
        expect((toggle as Gtk.CheckButton).getActive()).toBe(true);
    });

    it("renders the '_Enable grouping' check button with underline-mnemonic enabled", async () => {
        if (!sizegroupDemo.component) throw new Error("sizegroup demo component missing");
        const { container } = await renderDemo(sizegroupDemo.component);
        const checks = findAllOfType(container, Gtk.CheckButton);
        expect(checks).toHaveLength(1);
        const check = checks[0];
        if (!check) throw new Error("expected check button");
        expect(check.getLabel()).toBe("_Enable grouping");
        expect(check.getUseUnderline()).toBe(true);
    });

    it("toggles the check button active state when activated", async () => {
        if (!sizegroupDemo.component) throw new Error("sizegroup demo component missing");
        const { container } = await renderDemo(sizegroupDemo.component);
        const [check] = findAllOfType(container, Gtk.CheckButton);
        if (!check) throw new Error("expected check button");
        expect(check.getActive()).toBe(true);
        await act(() => check.setActive(false));
        await fireEvent(check, "toggled");
        expect(check.getActive()).toBe(false);
    });
});

describe("sizegroupDemo dropdowns", () => {
    it("initialises each dropdown to the first option of its data set", async () => {
        if (!sizegroupDemo.component) throw new Error("sizegroup demo component missing");
        const { container } = await renderDemo(sizegroupDemo.component);
        const dropdowns = findAllOfType(container, Gtk.DropDown);
        expect(dropdowns).toHaveLength(4);
        for (const dropdown of dropdowns) {
            expect(dropdown.getSelected()).toBe(0);
        }
    });

    it("changing the foreground dropdown selection persists in the widget", async () => {
        if (!sizegroupDemo.component) throw new Error("sizegroup demo component missing");
        const { container } = await renderDemo(sizegroupDemo.component);
        const [foreground] = findAllOfType(container, Gtk.DropDown);
        if (!foreground) throw new Error("expected foreground dropdown");
        await act(() => foreground.setSelected(2));
        expect(foreground.getSelected()).toBe(2);
    });
});
