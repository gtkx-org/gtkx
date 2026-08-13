import * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";
import * as Pango from "@gtkx/gi/pango";
import { act, fireEvent, screen, userEvent, waitFor, within } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { fontFeaturesDemo } from "../../../src/demos/advanced/font-features.js";
import { renderDemo } from "../../test-utils.js";

const isRgbaEqual = (button: Gtk.ColorDialogButton, r: number, g: number, b: number): boolean => {
    const color = button.getRgba();

    return Math.abs(color.red - r) < 1e-6 && Math.abs(color.green - g) < 1e-6 && Math.abs(color.blue - b) < 1e-6;
};

const expandFeatures = async (): Promise<void> => {
    const expander = await screen.findByName("features-expander");
    await userEvent.click(expander);
};

const renderExpandedFeatures = async (): Promise<void> => {
    await renderDemo(fontFeaturesDemo);
    await expandFeatures();
};

const findFeatureCheck = async (name: string): Promise<Gtk.Widget> =>
    await screen.findByRole(Gtk.AccessibleRole.CHECKBOX, { name });

const findSettingsLabel = async (): Promise<Gtk.Label> => await screen.findByName("settings", { as: Gtk.Label });

const commitEntryValue = async (name: string, value: string): Promise<Gtk.Entry> => {
    await renderDemo(fontFeaturesDemo);
    const entry = await screen.findByName(name, { as: Gtk.Entry });
    await userEvent.clear(entry);
    await userEvent.type(entry, value);
    await userEvent.keyboard(entry, "{Enter}");

    return entry;
};

const renderColorButtons = async (): Promise<{ fg: Gtk.ColorDialogButton; bg: Gtk.ColorDialogButton }> => {
    await renderDemo(fontFeaturesDemo);
    const fg = await screen.findByName("foreground-color", { as: Gtk.ColorDialogButton });
    const bg = await screen.findByName("background-color", { as: Gtk.ColorDialogButton });

    return { fg, bg };
};

const renderViewToggles = async (): Promise<{ plain: Gtk.ToggleButton; waterfall: Gtk.ToggleButton }> => {
    await renderDemo(fontFeaturesDemo);
    const plain = await screen.findByName("plain_toggle", { as: Gtk.ToggleButton });
    const waterfall = await screen.findByName("waterfall_toggle", { as: Gtk.ToggleButton });

    return { plain, waterfall };
};

const enterEditMode = async (): Promise<Gtk.Stack> => {
    await renderDemo(fontFeaturesDemo);
    const editToggle = await screen.findByName("edit_toggle", { as: Gtk.ToggleButton });
    await userEvent.click(editToggle);

    return await screen.findByName("stack", { as: Gtk.Stack });
};

const activateKerningFeature = async (): Promise<Gtk.Label> => {
    await renderExpandedFeatures();
    const kerning = await findFeatureCheck("Kerning");
    await userEvent.click(kerning);
    const settings = await findSettingsLabel();

    await waitFor(() => {
        expect(settings).toHaveTextContent("kern=1");
    });

    return settings;
};

describe("fontFeaturesDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(fontFeaturesDemo.id).toBe("font-features");
        expect(fontFeaturesDemo.title).toBe("Pango/Font Explorer");

        expect(fontFeaturesDemo.description).toBe(
            "This example demonstrates support for OpenType font features with Pango attributes. " +
            "The attributes can be used manually or via Pango markup.\n\n" +
            "It can also be used to explore available features in OpenType fonts and their effect.\n\n" +
            "If the selected font supports OpenType font variations, " +
            "then the axes are also offered for customization.",
        );

        expect(fontFeaturesDemo.keywords).toEqual([]);
        expect(fontFeaturesDemo.sourceCode).toContain("const fontFeaturesDemo: Demo = {");
        expect(fontFeaturesDemo.defaultWidth).toBe(600);
        expect(fontFeaturesDemo.defaultHeight).toBe(500);
    });
});

describe("fontFeaturesDemo rendering", () => {
    it("expands the OpenType Features to reveal feature checkboxes", async () => {
        await renderExpandedFeatures();
        const kerning = await findFeatureCheck("Kerning");
        expect(kerning).not.toBeChecked();
    });

    it("renders the preview label with default paragraph sample", async () => {
        await renderDemo(fontFeaturesDemo);
        const label = await screen.findByName("preview-label", { as: Gtk.Label });
        expect(label).toHaveTextContent("Grumpy wizards");
    });

    it("renders three Slider/Entry rows bound to the initial Size, Letterspacing, Line Height values", async () => {
        await renderDemo(fontFeaturesDemo);
        expect(await screen.findByName("size_entry")).toHaveDisplayValue("14");
        expect(await screen.findByName("letterspacing_entry")).toHaveDisplayValue("0");
        expect(await screen.findByName("line_height_entry")).toHaveDisplayValue("1");
    });

    it("renders the settings label empty initially", async () => {
        await renderDemo(fontFeaturesDemo);
        const settings = await findSettingsLabel();
        expect(settings).not.toHaveTextContent();
    });
});

describe("fontFeaturesDemo view mode buttons", () => {
    it("renders Plain and Waterfall toggle buttons with Plain active by default", async () => {
        const { plain, waterfall } = await renderViewToggles();
        expect(plain).toBePressed();
        expect(waterfall).not.toBePressed();
    });

    it("switches to waterfall mode and renders multiple sized labels", async () => {
        const { waterfall } = await renderViewToggles();
        await userEvent.click(waterfall);
        const waterfallLabels = await screen.findAllByName("waterfall-label");
        expect(waterfallLabels).toHaveLength(15);
    });

    it("switches back to plain mode", async () => {
        const { plain, waterfall } = await renderViewToggles();
        await userEvent.click(waterfall);
        await userEvent.click(plain);
        expect(plain).toBePressed();
    });

    it("switches to edit mode and shows the TextView in the stack", async () => {
        const stack = await enterEditMode();
        expect(stack).toHaveObjectProperty("visibleChildName", "entry");
    });
});

describe("fontFeaturesDemo sample buttons", () => {
    it("cycles through alphabet samples on click", async () => {
        await renderDemo(fontFeaturesDemo);
        const alphabetBtn = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Alphabet", as: Gtk.Button });
        await userEvent.click(alphabetBtn);
        const label = await screen.findByName("preview-label", { as: Gtk.Label });

        await waitFor(() => {
            expect(label).toHaveTextContent("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
        });

        expect(screen.queryByText(/Grumpy wizards/)).toBeNull();
    });

    it("cycles through paragraph samples on click", async () => {
        await renderDemo(fontFeaturesDemo);
        const paragraphBtn = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Paragraph", as: Gtk.Button });
        await screen.findByText(/Grumpy wizards/);
        await userEvent.click(paragraphBtn);
        expect(screen.queryByText(/Grumpy wizards/)).toBeNull();
    });
});

describe("fontFeaturesDemo feature toggling", () => {
    it("activates Kerning when its checkbox is toggled", async () => {
        const settings = await activateKerningFeature();
        expect(settings).toHaveTextContent("kern=1");
    });

    it("cycles Kerning from active to explicitly-disabled on the second click (kern=0)", async () => {
        const settings = await activateKerningFeature();
        const kerning = await findFeatureCheck("Kerning");
        await userEvent.click(kerning);

        await waitFor(() => {
            expect(settings).toHaveTextContent("kern=0");
        });
    });

    it("selects a non-default radio value to enable a feature", async () => {
        await renderExpandedFeatures();
        const liningFigures = await findFeatureCheck("Lining Figures");
        await userEvent.click(liningFigures);
        const settings = await findSettingsLabel();

        await waitFor(() => {
            expect(settings).toHaveTextContent("lnum=1");
        });
    });
});

describe("fontFeaturesDemo titlebar", () => {
    it("sets a GtkHeaderBar as the window titlebar containing the Reset button", async () => {
        await renderDemo(fontFeaturesDemo);
        const header = await screen.findByName("font-features-header", { as: Gtk.HeaderBar });
        const resetButton = within(header).getByName("reset", { as: Gtk.Button });
        expect(resetButton).toHaveObjectProperty("iconName", "view-refresh-symbolic");
    });

    it("clicking the titlebar Reset button clears active feature settings in the body", async () => {
        const settings = await activateKerningFeature();
        const resetButton = await screen.findByName("reset", { as: Gtk.Button });
        await userEvent.click(resetButton);

        await waitFor(() => {
            expect(settings).not.toHaveTextContent();
        });
    });
});

describe("fontFeaturesDemo size entry", () => {
    it("accepts a valid size entry value", async () => {
        const sizeEntry = await commitEntryValue("size_entry", "24");
        expect(sizeEntry).toHaveDisplayValue("24");
    });

    it("ignores out-of-range size values without crashing the preview", async () => {
        await commitEntryValue("size_entry", "9999");
        const sliders = await screen.findAllByRole(Gtk.AccessibleRole.SLIDER);
        const sizeSlider = sliders[0] as Gtk.Scale;
        expect(sizeSlider.getValue()).toBe(14);
    });
});

describe("fontFeaturesDemo letterspacing entry", () => {
    it("accepts a valid letterspacing entry", async () => {
        const letterspacingEntry = await commitEntryValue("letterspacing_entry", "512");
        expect(letterspacingEntry).toHaveDisplayValue("512");
    });
});

describe("fontFeaturesDemo line-height entry", () => {
    it("accepts a valid line-height entry", async () => {
        const lineHeightEntry = await commitEntryValue("line_height_entry", "1.5");
        expect(lineHeightEntry).toHaveDisplayValue("1.5");
    });

    it("ignores invalid line-height values", async () => {
        await commitEntryValue("line_height_entry", "0.1");
        const sliders = await screen.findAllByRole(Gtk.AccessibleRole.SLIDER);
        const lineHeightSlider = sliders[2] as Gtk.Scale;
        expect(lineHeightSlider.getValue()).toBe(1);
    });
});

describe("fontFeaturesDemo color swap", () => {
    it("swaps the default foreground and background colors on click", async () => {
        const { fg, bg } = await renderColorButtons();
        expect(isRgbaEqual(fg, 0, 0, 0)).toBe(true);
        expect(isRgbaEqual(bg, 1, 1, 1)).toBe(true);
        const swap = await screen.findByName("swap-colors", { as: Gtk.Button });
        await fireEvent(swap, "clicked");

        await waitFor(() => {
            expect(isRgbaEqual(fg, 1, 1, 1)).toBe(true);
        });

        expect(isRgbaEqual(bg, 0, 0, 0)).toBe(true);
    });

    it("applies a foreground color change and carries it to the background on swap", async () => {
        const { fg, bg } = await renderColorButtons();
        const red = new Gdk.RGBA();
        red.red = 1;
        red.green = 0;
        red.blue = 0;
        red.alpha = 1;

        await act(() => {
            fg.setRgba(red);
        });

        await waitFor(() => {
            expect(isRgbaEqual(fg, 1, 0, 0)).toBe(true);
        });

        const swap = await screen.findByName("swap-colors", { as: Gtk.Button });
        await fireEvent(swap, "clicked");

        await waitFor(() => {
            expect(isRgbaEqual(bg, 1, 0, 0)).toBe(true);
        });
    });
});

describe("fontFeaturesDemo font button", () => {
    it("derives the size from a selected font description", async () => {
        await renderDemo(fontFeaturesDemo);
        const fontButton = await screen.findByName("font-button", { as: Gtk.FontDialogButton });

        await act(() => {
            fontButton.setFontDesc(Pango.FontDescription.fromString("Sans 30"));
        });

        const sizeEntry = await screen.findByName("size_entry", { as: Gtk.Entry });

        await waitFor(() => {
            expect(sizeEntry).toHaveDisplayValue("30");
        });
    });
});

describe("fontFeaturesDemo sliders", () => {
    it("updates the size via the Size scale and reflects it in the entry", async () => {
        await renderDemo(fontFeaturesDemo);
        const sliders = await screen.findAllByRole(Gtk.AccessibleRole.SLIDER);
        const sizeSlider = sliders[0] as Gtk.Scale;
        expect(sizeSlider.getValue()).toBe(14);
        sizeSlider.grabFocus();
        await userEvent.keyboard(sizeSlider, "{PageUp}");

        await waitFor(() => {
            expect(sizeSlider).toHaveValue(24);
        });

        const sizeEntry = await screen.findByName("size_entry", { as: Gtk.Entry });

        await waitFor(() => {
            expect(sizeEntry).toHaveDisplayValue("24");
        });
    });
});

describe("fontFeaturesDemo edit mode Escape", () => {
    it("reverts edits and returns to plain view when Escape is pressed", async () => {
        const stack = await enterEditMode();
        expect(stack).toHaveObjectProperty("visibleChildName", "entry");
        const textView = await screen.findByName("edit_textview", { as: Gtk.TextView });
        textView.grabFocus();
        await userEvent.type(textView, "scratch edits");
        await userEvent.keyboard(textView, "{Escape}");

        await waitFor(() => {
            expect(stack).toHaveObjectProperty("visibleChildName", "label");
        });

        const preview = await screen.findByName("preview-label", { as: Gtk.Label });
        expect(preview).toHaveTextContent("Grumpy wizards");
    });
});
