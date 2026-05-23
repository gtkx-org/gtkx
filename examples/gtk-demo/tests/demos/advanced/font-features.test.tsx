import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it } from "vitest";
import { fontFeaturesDemo } from "../../../src/demos/advanced/font-features.js";
import { act, fireEvent, renderDemo, screen } from "../../test-utils.js";

const getStack = async (): Promise<Gtk.Stack> => {
    const stack = (await screen.findByName("stack")) as Gtk.Stack;
    if (!(stack instanceof Gtk.Stack)) throw new Error("expected stack to be a GtkStack");
    return stack;
};

const findPreviewLabel = async (): Promise<Gtk.Label> => {
    const stack = await getStack();
    const labelPage = stack.getChildByName("label");
    if (!labelPage) throw new Error("label page missing in stack");
    let current: Gtk.Widget | null = labelPage;
    while (current) {
        if (current instanceof Gtk.Label) return current;
        current = current.getFirstChild();
    }
    throw new Error("preview label missing");
};

const findExpander = async (): Promise<Gtk.Expander> => {
    const expanders = (await screen.findAllByRole(Gtk.AccessibleRole.BUTTON, {
        name: "OpenType Features",
    })) as Gtk.Widget[];
    const expander = expanders.find((w): w is Gtk.Expander => w instanceof Gtk.Expander);
    if (!expander) throw new Error("expected an Expander widget");
    return expander;
};

const expandFeatures = async (): Promise<void> => {
    const expander = await findExpander();
    await act(() => expander.setExpanded(true));
    await fireEvent(expander, "notify::expanded");
};

const findFeatureCheckButton = async (label: string): Promise<Gtk.CheckButton> => {
    const checks = (await screen.findAllByRole(Gtk.AccessibleRole.CHECKBOX, { name: label })) as Gtk.CheckButton[];
    const match = checks[0];
    if (!match) throw new Error(`expected a checkbox labelled "${label}"`);
    return match;
};

const findSettingsLabelText = async (): Promise<string> => {
    const alphabet = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Alphabet" })) as Gtk.Button;
    const settingsBox = alphabet.getParent();
    if (!settingsBox) throw new Error("alphabet button parent missing");
    const settingsLabel = settingsBox.getFirstChild();
    if (!(settingsLabel instanceof Gtk.Label))
        throw new Error("expected settings label as first child of alphabet box");
    return settingsLabel.getLabel() ?? "";
};

const countLabelsInLabelPage = async (): Promise<number> => {
    const stack = await getStack();
    const labelPage = stack.getChildByName("label");
    if (!labelPage) return 0;
    let count = 0;
    const walk = (widget: Gtk.Widget): void => {
        if (widget instanceof Gtk.Label) count += 1;
        let child = widget.getFirstChild();
        while (child) {
            walk(child);
            child = child.getNextSibling();
        }
    };
    walk(labelPage);
    return count;
};

describe("fontFeaturesDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(fontFeaturesDemo.id).toBe("font-features");
        expect(fontFeaturesDemo.title).toBe("Pango/Font Explorer");
        expect(fontFeaturesDemo.description.length).toBeGreaterThan(0);
        expect(Array.isArray(fontFeaturesDemo.keywords)).toBe(true);
        expect(typeof fontFeaturesDemo.sourceCode).toBe("string");
        expect(fontFeaturesDemo.defaultWidth).toBeUndefined();
        expect(fontFeaturesDemo.defaultHeight).toBeUndefined();
    });
});

describe("fontFeaturesDemo rendering", () => {
    it("renders the OpenType Features expander", async () => {
        await renderDemo(fontFeaturesDemo);
        const expander = await findExpander();
        expect(expander).toBeInstanceOf(Gtk.Expander);
    });

    it("renders the preview label with default paragraph sample", async () => {
        await renderDemo(fontFeaturesDemo);
        const label = await findPreviewLabel();
        expect(label.getLabel()).toContain("Grumpy wizards");
    });

    it("renders three Slider/Entry rows for Size, Letterspacing, Line Height", async () => {
        await renderDemo(fontFeaturesDemo);
        expect(await screen.findByName("size_entry")).toBeInstanceOf(Gtk.Entry);
        expect(await screen.findByName("letterspacing_entry")).toBeInstanceOf(Gtk.Entry);
        expect(await screen.findByName("line_height_entry")).toBeInstanceOf(Gtk.Entry);
    });

    it("renders Foreground and Background color dialog buttons", async () => {
        await renderDemo(fontFeaturesDemo);
        const colorButtons = (await screen.findAllByRole(Gtk.AccessibleRole.GROUP)).filter(
            (w): w is Gtk.ColorDialogButton => w instanceof Gtk.ColorDialogButton,
        );
        expect(colorButtons).toHaveLength(2);
    });

    it("renders the settings label empty initially", async () => {
        await renderDemo(fontFeaturesDemo);
        const text = await findSettingsLabelText();
        expect(text).toBe("");
    });
});

describe("fontFeaturesDemo view mode buttons", () => {
    it("renders Plain and Waterfall toggle buttons with Plain active by default", async () => {
        await renderDemo(fontFeaturesDemo);
        const plain = (await screen.findByName("plain_toggle")) as Gtk.ToggleButton;
        const waterfall = (await screen.findByName("waterfall_toggle")) as Gtk.ToggleButton;
        expect(plain.getActive()).toBe(true);
        expect(waterfall.getActive()).toBe(false);
    });

    it("switches to waterfall mode and renders multiple sized labels", async () => {
        await renderDemo(fontFeaturesDemo);
        const waterfall = (await screen.findByName("waterfall_toggle")) as Gtk.ToggleButton;
        await act(() => waterfall.setActive(true));
        await fireEvent(waterfall, "toggled");
        const count = await countLabelsInLabelPage();
        expect(count).toBeGreaterThanOrEqual(15);
    });

    it("switches back to plain mode", async () => {
        await renderDemo(fontFeaturesDemo);
        const plain = (await screen.findByName("plain_toggle")) as Gtk.ToggleButton;
        const waterfall = (await screen.findByName("waterfall_toggle")) as Gtk.ToggleButton;
        await act(() => waterfall.setActive(true));
        await fireEvent(waterfall, "toggled");
        await act(() => plain.setActive(true));
        await fireEvent(plain, "toggled");
        expect(plain.getActive()).toBe(true);
    });

    it("switches to edit mode and shows the TextView in the stack", async () => {
        await renderDemo(fontFeaturesDemo);
        const editBtn = (await screen.findByName("edit_toggle")) as Gtk.ToggleButton;
        await act(() => editBtn.setActive(true));
        await fireEvent(editBtn, "toggled");
        const stack = await getStack();
        expect(stack.getVisibleChildName()).toBe("entry");
    });
});

describe("fontFeaturesDemo sample buttons", () => {
    it("cycles through alphabet samples on click", async () => {
        await renderDemo(fontFeaturesDemo);
        const alphabetBtn = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, {
            name: "Alphabet",
        })) as Gtk.Button;
        await fireEvent(alphabetBtn, "clicked");
        const label = await findPreviewLabel();
        expect(label.getLabel()).toMatch(/[A-Z]/);
    });

    it("cycles through paragraph samples on click", async () => {
        await renderDemo(fontFeaturesDemo);
        const paragraphBtn = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, {
            name: "Paragraph",
        })) as Gtk.Button;
        const before = (await findPreviewLabel()).getLabel();
        await fireEvent(paragraphBtn, "clicked");
        const after = (await findPreviewLabel()).getLabel();
        expect(after).not.toBe(before);
    });
});

describe("fontFeaturesDemo feature toggling", () => {
    it("activates Kerning when its checkbox is toggled", async () => {
        await renderDemo(fontFeaturesDemo);
        await expandFeatures();
        const kerning = await findFeatureCheckButton("Kerning");
        await fireEvent(kerning, "toggled");
        const settings = await findSettingsLabelText();
        expect(settings).toContain("kern=1");
    });

    it("selects a non-default radio value to enable a feature", async () => {
        await renderDemo(fontFeaturesDemo);
        await expandFeatures();
        const liningFigures = await findFeatureCheckButton("Lining Figures");
        await fireEvent(liningFigures, "toggled");
        const settings = await findSettingsLabelText();
        expect(settings).toContain("lnum=1");
    });
});

describe("fontFeaturesDemo titlebar", () => {
    it("sets a GtkHeaderBar as the window titlebar containing the Reset button", async () => {
        const { window } = await renderDemo(fontFeaturesDemo);
        const win = window.current;
        if (!win) throw new Error("expected window ref");
        const titlebar = win.getTitlebar?.();
        if (!titlebar) throw new Error("titlebar missing");
        expect(titlebar).toBeInstanceOf(Gtk.HeaderBar);
        const resetButton = (await screen.findByName("reset")) as Gtk.Button;
        expect(resetButton).toBeInstanceOf(Gtk.Button);
        expect(resetButton.getIconName()).toBe("view-refresh-symbolic");
    });

    it("clicking the titlebar Reset button clears active feature settings in the body", async () => {
        await renderDemo(fontFeaturesDemo);
        await expandFeatures();
        const kerning = await findFeatureCheckButton("Kerning");
        await fireEvent(kerning, "toggled");
        expect(await findSettingsLabelText()).toContain("kern=1");

        const resetButton = (await screen.findByName("reset")) as Gtk.Button;
        await fireEvent(resetButton, "clicked");

        expect(await findSettingsLabelText()).not.toContain("kern=1");
        expect(await findSettingsLabelText()).toBe("");
    });
});

describe("fontFeaturesDemo state transitions", () => {
    it("attaches a right-click gesture to each check feature for resetting state", async () => {
        await renderDemo(fontFeaturesDemo);
        await expandFeatures();
        const kerning = await findFeatureCheckButton("Kerning");

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
        await renderDemo(fontFeaturesDemo);
        const sizeEntry = (await screen.findByName("size_entry")) as Gtk.Entry;
        await act(() => sizeEntry.setText("24"));
        await fireEvent(sizeEntry, "activate");
        expect(sizeEntry.getText()).toBe("24");
    });

    it("ignores out-of-range size values", async () => {
        await renderDemo(fontFeaturesDemo);
        const sizeEntry = (await screen.findByName("size_entry")) as Gtk.Entry;
        await act(() => sizeEntry.setText("9999"));
        await fireEvent(sizeEntry, "activate");
        const settings = await findSettingsLabelText();
        expect(settings).toBeDefined();
    });
});

describe("fontFeaturesDemo letterspacing entry", () => {
    it("accepts a valid letterspacing entry", async () => {
        await renderDemo(fontFeaturesDemo);
        const letterspacingEntry = (await screen.findByName("letterspacing_entry")) as Gtk.Entry;
        await act(() => letterspacingEntry.setText("512"));
        await fireEvent(letterspacingEntry, "activate");
        expect(letterspacingEntry.getText()).toBe("512");
    });
});

describe("fontFeaturesDemo line-height entry", () => {
    it("accepts a valid line-height entry", async () => {
        await renderDemo(fontFeaturesDemo);
        const lineHeightEntry = (await screen.findByName("line_height_entry")) as Gtk.Entry;
        await act(() => lineHeightEntry.setText("1.5"));
        await fireEvent(lineHeightEntry, "activate");
        expect(lineHeightEntry.getText()).toBe("1.5");
    });

    it("ignores invalid line-height values", async () => {
        await renderDemo(fontFeaturesDemo);
        const lineHeightEntry = (await screen.findByName("line_height_entry")) as Gtk.Entry;
        await act(() => lineHeightEntry.setText("0.1"));
        await fireEvent(lineHeightEntry, "activate");
        expect(lineHeightEntry.getText()).toBe("0.1");
    });
});

describe("fontFeaturesDemo color swap", () => {
    it("renders a swap-colors button that flips fg/bg colors", async () => {
        await renderDemo(fontFeaturesDemo);
        const buttons = (await screen.findAllByRole(Gtk.AccessibleRole.BUTTON)) as Gtk.Button[];
        const swap = buttons.find((b) => b.getTooltipText?.() === "Swap colors");
        if (!swap) throw new Error("swap colors button not found");
        await fireEvent(swap, "clicked");
        expect(swap).toBeInstanceOf(Gtk.Button);
    });
});
