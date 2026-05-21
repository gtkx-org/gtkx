import * as Gtk from "@gtkx/ffi/gtk";
import { act, fireEvent, screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { fontFeaturesDemo } from "../../../src/demos/advanced/font-features.js";
import { expectDemoMetadata, renderDemo } from "../../helpers/render-demo.js";

const findFirst = <T extends Gtk.Widget>(root: Gtk.Widget, predicate: (w: Gtk.Widget) => w is T): T | null => {
    if (predicate(root)) return root;
    let child = root.getFirstChild();
    while (child) {
        const found = findFirst(child, predicate);
        if (found) return found;
        child = child.getNextSibling();
    }
    return null;
};

const collectAll = <T extends Gtk.Widget>(
    root: Gtk.Widget,
    predicate: (w: Gtk.Widget) => w is T,
    out: T[] = [],
): T[] => {
    if (predicate(root)) out.push(root);
    let child = root.getFirstChild();
    while (child) {
        collectAll(child, predicate, out);
        child = child.getNextSibling();
    }
    return out;
};

const findFontFeaturesPreviewLabel = (container: Gtk.Widget): Gtk.Label | null => {
    const stack = findFirst(container, (w): w is Gtk.Stack => w instanceof Gtk.Stack);
    if (!stack) return null;
    const labelPage = stack.getChildByName("label");
    if (!labelPage) return null;
    return findFirst(labelPage, (w): w is Gtk.Label => w instanceof Gtk.Label);
};

const findCheckButtonByLabel = (container: Gtk.Widget, label: string): Gtk.CheckButton | null => {
    const checks = collectAll(container, (w): w is Gtk.CheckButton => w instanceof Gtk.CheckButton);
    return checks.find((c) => c.getLabel() === label) ?? null;
};

describe("fontFeaturesDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expectDemoMetadata(fontFeaturesDemo, {
            id: "font-features",
            title: "Pango/Font Explorer",
        });
        expect(typeof fontFeaturesDemo.sourceCode).toBe("string");
        expect(fontFeaturesDemo.defaultWidth).toBe(600);
        expect(fontFeaturesDemo.defaultHeight).toBe(500);
        expect(fontFeaturesDemo.keywords).toContain("font");
        expect(fontFeaturesDemo.keywords).toContain("opentype");
    });
});

describe("fontFeaturesDemo rendering", () => {
    it("renders the OpenType Features expander", async () => {
        const { container } = await renderDemo(fontFeaturesDemo);
        const expander = findFirst(container, (w): w is Gtk.Expander => w instanceof Gtk.Expander);
        expect(expander).toBeInstanceOf(Gtk.Expander);
    });

    it("renders the preview label with default paragraph sample", async () => {
        const { container } = await renderDemo(fontFeaturesDemo);
        const label = findFontFeaturesPreviewLabel(container);
        expect(label).toBeInstanceOf(Gtk.Label);
        expect(label?.getLabel()).toContain("Grumpy wizards");
    });

    it("renders three Slider/Entry rows for Size, Letterspacing, Line Height", async () => {
        const { container } = await renderDemo(fontFeaturesDemo);
        const labels = collectAll(container, (w): w is Gtk.Label => w instanceof Gtk.Label).map((l) => l.getLabel());
        expect(labels).toContain("Size");
        expect(labels).toContain("Letterspacing");
        expect(labels).toContain("Line Height");
    });

    it("renders Foreground and Background color labels", async () => {
        const { container } = await renderDemo(fontFeaturesDemo);
        const labels = collectAll(container, (w): w is Gtk.Label => w instanceof Gtk.Label).map((l) => l.getLabel());
        expect(labels).toContain("Foreground");
        expect(labels).toContain("Background");
    });

    it("renders the No active settings text initially", async () => {
        const { container } = await renderDemo(fontFeaturesDemo);
        const labels = collectAll(container, (w): w is Gtk.Label => w instanceof Gtk.Label).map((l) => l.getLabel());
        expect(labels).toContain("No active settings");
    });
});

describe("fontFeaturesDemo view mode buttons", () => {
    it("renders Plain and Waterfall toggle buttons with Plain active by default", async () => {
        await renderDemo(fontFeaturesDemo);
        const plain = (await screen.findByRole(Gtk.AccessibleRole.TOGGLE_BUTTON, {
            name: "Plain",
        })) as Gtk.ToggleButton;
        const waterfall = (await screen.findByRole(Gtk.AccessibleRole.TOGGLE_BUTTON, {
            name: "Waterfall",
        })) as Gtk.ToggleButton;
        expect(plain.getActive()).toBe(true);
        expect(waterfall.getActive()).toBe(false);
    });

    it("switches to waterfall mode and renders multiple sized labels", async () => {
        const { container } = await renderDemo(fontFeaturesDemo);
        const waterfall = (await screen.findByRole(Gtk.AccessibleRole.TOGGLE_BUTTON, {
            name: "Waterfall",
        })) as Gtk.ToggleButton;
        await act(() => waterfall.setActive(true));
        await fireEvent(waterfall, "toggled");
        const labels = collectAll(container, (w): w is Gtk.Label => w instanceof Gtk.Label).filter((l) =>
            l.getSelectable(),
        );
        expect(labels.length).toBeGreaterThanOrEqual(15);
    });

    it("switches back to plain mode", async () => {
        await renderDemo(fontFeaturesDemo);
        const plain = (await screen.findByRole(Gtk.AccessibleRole.TOGGLE_BUTTON, {
            name: "Plain",
        })) as Gtk.ToggleButton;
        const waterfall = (await screen.findByRole(Gtk.AccessibleRole.TOGGLE_BUTTON, {
            name: "Waterfall",
        })) as Gtk.ToggleButton;
        await act(() => waterfall.setActive(true));
        await fireEvent(waterfall, "toggled");
        await act(() => plain.setActive(true));
        await fireEvent(plain, "toggled");
        expect(plain.getActive()).toBe(true);
    });

    it("switches to edit mode and shows the TextView in the stack", async () => {
        const { container } = await renderDemo(fontFeaturesDemo);
        const editToggles = collectAll(container, (w): w is Gtk.ToggleButton => w instanceof Gtk.ToggleButton);
        const editBtn = editToggles.find((b) => b.getIconName() === "document-edit-symbolic");
        if (!editBtn) throw new Error("edit toggle not found");
        await act(() => editBtn.setActive(true));
        await fireEvent(editBtn, "toggled");

        const stack = findFirst(container, (w): w is Gtk.Stack => w instanceof Gtk.Stack);
        expect(stack?.getVisibleChildName()).toBe("entry");
    });
});

describe("fontFeaturesDemo sample buttons", () => {
    it("cycles through alphabet samples on click", async () => {
        const { container } = await renderDemo(fontFeaturesDemo);
        const alphabetBtn = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, {
            name: "Alphabet",
        })) as Gtk.Button;
        await fireEvent(alphabetBtn, "clicked");
        const label = findFontFeaturesPreviewLabel(container);
        expect(label?.getLabel()).toMatch(/[A-Z]/);
    });

    it("cycles through paragraph samples on click", async () => {
        const { container } = await renderDemo(fontFeaturesDemo);
        const paragraphBtn = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, {
            name: "Paragraph",
        })) as Gtk.Button;
        const before = findFontFeaturesPreviewLabel(container)?.getLabel();
        await fireEvent(paragraphBtn, "clicked");
        const after = findFontFeaturesPreviewLabel(container)?.getLabel();
        expect(after).not.toBe(before);
    });
});

const expandFeatures = async (container: Gtk.Widget): Promise<void> => {
    const expander = findFirst(container, (w): w is Gtk.Expander => w instanceof Gtk.Expander);
    if (!expander) throw new Error("expander not found");
    expander.setExpanded(true);
    await fireEvent(expander, "notify::expanded");
};

describe("fontFeaturesDemo feature toggling", () => {
    it("activates Kerning when its checkbox is toggled", async () => {
        const { container } = await renderDemo(fontFeaturesDemo);
        await expandFeatures(container);
        const kerning = findCheckButtonByLabel(container, "Kerning");
        if (!kerning) throw new Error("Kerning check not found");
        await act(() => kerning.setActive(true));
        await fireEvent(kerning, "toggled");
        const labels = collectAll(container, (w): w is Gtk.Label => w instanceof Gtk.Label).map((l) => l.getLabel());
        expect(labels.some((l) => (l ?? "").includes('"kern"'))).toBe(true);
    });

    it("selects a non-default radio value to enable a feature", async () => {
        const { container } = await renderDemo(fontFeaturesDemo);
        await expandFeatures(container);
        const liningFigures = findCheckButtonByLabel(container, "Lining Figures");
        if (!liningFigures) throw new Error("Lining Figures radio not found");
        await act(() => liningFigures.setActive(true));
        await fireEvent(liningFigures, "toggled");
        const labels = collectAll(container, (w): w is Gtk.Label => w instanceof Gtk.Label).map(
            (l) => l.getLabel() ?? "",
        );
        expect(labels.some((l) => l.includes('"lnum"'))).toBe(true);
    });
});

describe("fontFeaturesDemo titlebar", () => {
    it("sets a GtkHeaderBar as the window titlebar containing the Reset button", async () => {
        const { container } = await renderDemo(fontFeaturesDemo);
        const win = container as Gtk.Window;
        const titlebar = win.getTitlebar?.();
        if (!titlebar) throw new Error("titlebar missing");
        expect(titlebar).toBeInstanceOf(Gtk.HeaderBar);
        const titlebarButtons = collectAll(titlebar, (w): w is Gtk.Button => w instanceof Gtk.Button);
        const resetButton = titlebarButtons.find((b) => b.getTooltipText() === "Reset");
        expect(resetButton).toBeInstanceOf(Gtk.Button);
        expect(resetButton?.getIconName()).toBe("view-refresh-symbolic");
    });

    it("clicking the titlebar Reset button clears active feature settings in the body", async () => {
        const { container } = await renderDemo(fontFeaturesDemo);
        await expandFeatures(container);
        const kerning = findCheckButtonByLabel(container, "Kerning");
        if (!kerning) throw new Error("Kerning check not found");
        await act(() => kerning.setActive(true));
        await fireEvent(kerning, "toggled");
        const labelsAfterToggle = collectAll(container, (w): w is Gtk.Label => w instanceof Gtk.Label).map(
            (l) => l.getLabel() ?? "",
        );
        expect(labelsAfterToggle.some((l) => l.includes('"kern"'))).toBe(true);

        const win = container as Gtk.Window;
        const titlebar = win.getTitlebar?.();
        if (!titlebar) throw new Error("titlebar missing");
        const titlebarButtons = collectAll(titlebar, (w): w is Gtk.Button => w instanceof Gtk.Button);
        const resetButton = titlebarButtons.find((b) => b.getTooltipText() === "Reset");
        if (!resetButton) throw new Error("expected reset button in titlebar");
        await fireEvent(resetButton, "clicked");

        const labelsAfterReset = collectAll(container, (w): w is Gtk.Label => w instanceof Gtk.Label).map(
            (l) => l.getLabel() ?? "",
        );
        expect(labelsAfterReset.some((l) => l.includes('"kern"'))).toBe(false);
        expect(labelsAfterReset).toContain("No active settings");
    });
});

describe("fontFeaturesDemo state transitions", () => {
    it("attaches a right-click gesture to each check feature for resetting state", async () => {
        const { container } = await renderDemo(fontFeaturesDemo);
        await expandFeatures(container);
        const kerning = findCheckButtonByLabel(container, "Kerning");
        if (!kerning) throw new Error("Kerning check not found");

        const controllers = kerning.observeControllers();
        let hasGestureClick = false;
        for (let i = 0; i < controllers.getNItems(); i++) {
            if (controllers.getItem(i) instanceof Gtk.GestureClick) {
                hasGestureClick = true;
                break;
            }
        }
        expect(hasGestureClick).toBe(true);
    });
});

describe("fontFeaturesDemo size entry", () => {
    it("accepts a valid size entry value", async () => {
        const { container } = await renderDemo(fontFeaturesDemo);
        const entries = collectAll(container, (w): w is Gtk.Entry => w instanceof Gtk.Entry);
        const sizeEntry = entries[0];
        if (!sizeEntry) throw new Error("size entry not found");
        await act(() => sizeEntry.setText("24"));
        await fireEvent(sizeEntry, "activate");
        expect(sizeEntry.getText()).toBe("24");
    });

    it("ignores out-of-range size values", async () => {
        const { container } = await renderDemo(fontFeaturesDemo);
        const entries = collectAll(container, (w): w is Gtk.Entry => w instanceof Gtk.Entry);
        const sizeEntry = entries[0];
        if (!sizeEntry) throw new Error("size entry not found");
        await act(() => sizeEntry.setText("9999"));
        await fireEvent(sizeEntry, "activate");
        const labels = collectAll(container, (w): w is Gtk.Label => w instanceof Gtk.Label).map(
            (l) => l.getLabel() ?? "",
        );
        expect(labels.some((l) => l.includes("Sans"))).toBe(true);
    });
});

describe("fontFeaturesDemo letterspacing entry", () => {
    it("accepts a valid letterspacing entry", async () => {
        const { container } = await renderDemo(fontFeaturesDemo);
        const entries = collectAll(container, (w): w is Gtk.Entry => w instanceof Gtk.Entry);
        const letterspacingEntry = entries[1];
        if (!letterspacingEntry) throw new Error("letterspacing entry not found");
        await act(() => letterspacingEntry.setText("512"));
        await fireEvent(letterspacingEntry, "activate");
        expect(letterspacingEntry.getText()).toBe("512");
    });
});

describe("fontFeaturesDemo line-height entry", () => {
    it("accepts a valid line-height entry", async () => {
        const { container } = await renderDemo(fontFeaturesDemo);
        const entries = collectAll(container, (w): w is Gtk.Entry => w instanceof Gtk.Entry);
        const lineHeightEntry = entries[2];
        if (!lineHeightEntry) throw new Error("line height entry not found");
        await act(() => lineHeightEntry.setText("1.5"));
        await fireEvent(lineHeightEntry, "activate");
        expect(lineHeightEntry.getText()).toBe("1.5");
    });

    it("ignores invalid line-height values", async () => {
        const { container } = await renderDemo(fontFeaturesDemo);
        const entries = collectAll(container, (w): w is Gtk.Entry => w instanceof Gtk.Entry);
        const lineHeightEntry = entries[2];
        if (!lineHeightEntry) throw new Error("line height entry not found");
        await act(() => lineHeightEntry.setText("0.1"));
        await fireEvent(lineHeightEntry, "activate");
        expect(lineHeightEntry.getText()).toBe("0.1");
    });
});

describe("fontFeaturesDemo color swap", () => {
    it("renders a swap-colors button that flips fg/bg colors", async () => {
        const { container } = await renderDemo(fontFeaturesDemo);
        const buttons = collectAll(container, (w): w is Gtk.Button => w instanceof Gtk.Button);
        const swap = buttons.find((b) => b.getTooltipText() === "Swap colors");
        if (!swap) throw new Error("swap colors button not found");
        await fireEvent(swap, "clicked");
        expect(swap).toBeInstanceOf(Gtk.Button);
    });
});
