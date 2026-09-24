import * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";
import * as Pango from "@gtkx/gi/pango";
import { act, screen, screenshot, userEvent, waitFor, within } from "@gtkx/testing";
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

const findFeatureCheck = async (name: string): Promise<Gtk.CheckButton> =>
    await screen.findByRole(Gtk.AccessibleRole.CHECKBOX, { name });

const findFeatureRadio = async (name: string): Promise<Gtk.CheckButton> =>
    await screen.findByRole(Gtk.AccessibleRole.RADIO, { name, as: Gtk.CheckButton });

const findPreview = async (): Promise<Gtk.Label> => await screen.findByName("preview-label", { as: Gtk.Label });

const requirePreviewAttribute = (label: Gtk.Label, type: Pango.AttrType): Pango.Attribute => {
    const attribute = label.getAttributes()?.getAttributes().find((candidate) => candidate.klass.type === type);

    if (!attribute) {
        throw new Error("Missing preview attribute");
    }

    return attribute;
};

const requireFontDescription = (label: Gtk.Label): Pango.FontDescription => {
    const fontAttribute = requirePreviewAttribute(label, Pango.AttrType.FONT_DESC).asFontDesc();

    if (!fontAttribute) {
        throw new Error("Invalid font description attribute");
    }

    return fontAttribute.desc;
};

const findSettingsLabel = async (): Promise<Gtk.Label> => await screen.findByName("settings", { as: Gtk.Label });

const activateEntryValue = async (name: string, value: string): Promise<Gtk.Entry> => {
    const entry = await screen.findByName(name, { as: Gtk.Entry });
    await userEvent.clear(entry);
    await userEvent.type(entry, value);
    await userEvent.keyboard(entry, "{Enter}");

    return entry;
};

const commitEntryValue = async (name: string, value: string): Promise<Gtk.Entry> => {
    await renderDemo(fontFeaturesDemo);

    return await activateEntryValue(name, value);
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

    it("labels the initial size, letter spacing, and line-height controls", async () => {
        await renderDemo(fontFeaturesDemo);
        expect(await screen.findByRole(Gtk.AccessibleRole.SLIDER, { name: "Size" })).toHaveValue(14);
        expect(await screen.findByRole(Gtk.AccessibleRole.SLIDER, { name: "Letterspacing" })).toHaveValue(0);
        expect(await screen.findByRole(Gtk.AccessibleRole.SLIDER, { name: "Line Height" })).toHaveValue(1);
        await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX, { name: "Size" });
        await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX, { name: "Letterspacing" });
        await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX, { name: "Line Height" });
        await screen.findByRole(Gtk.AccessibleRole.GROUP, { name: "Font" });
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
        const waterfallLabels = await screen.findAllByName("waterfall-label", { as: Gtk.Label });
        expect(waterfallLabels).toHaveLength(15);
        const first = waterfallLabels[0];
        const last = waterfallLabels.at(-1);

        if (!first || !last) {
            throw new Error("Missing waterfall labels");
        }

        expect(Pango.unitsToDouble(requireFontDescription(first).getSize())).toBe(7);
        expect(Pango.unitsToDouble(requireFontDescription(last).getSize())).toBe(90);
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
        const feature = requirePreviewAttribute(await findPreview(), Pango.AttrType.FONT_FEATURES);
        expect(feature.startIndex).toBe(Pango.ATTR_INDEX_FROM_TEXT_BEGINNING);
        expect(feature.endIndex).toBe(Pango.ATTR_INDEX_TO_TEXT_END);
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
        const liningFigures = await findFeatureRadio("Lining Figures");
        const oldstyleFigures = await findFeatureRadio("Oldstyle Figures");
        await userEvent.click(liningFigures);
        const settings = await findSettingsLabel();

        await waitFor(() => {
            expect(settings).toHaveTextContent("lnum=1");
        });

        expect(liningFigures).toBeChecked();
        expect(oldstyleFigures).not.toBeChecked();
        await userEvent.click(oldstyleFigures);

        await waitFor(() => {
            expect(liningFigures).not.toBeChecked();
            expect(oldstyleFigures).toBeChecked();
            expect(settings).toHaveTextContent("onum=1");
        });
    });

    it("applies features to the selected UTF-8 byte range", async () => {
        await renderDemo(fontFeaturesDemo);
        await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Paragraph" }));
        const preview = await findPreview();
        preview.grabFocus();
        await userEvent.keyboard(preview, "{Home}{Shift>}{ArrowRight}{/Shift}");
        expect(preview.getSelectionBounds()).toEqual([true, 0, 1]);
        await expandFeatures();
        await userEvent.click(await findFeatureCheck("Kerning"));

        await waitFor(() => {
            const feature = requirePreviewAttribute(preview, Pango.AttrType.FONT_FEATURES);
            expect(feature.startIndex).toBe(0);
            expect(feature.endIndex).toBe(2);
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

    it("restores the initial font and presentation", async () => {
        await renderExpandedFeatures();
        const preview = await findPreview();
        const initial = await screenshot(preview);
        await activateEntryValue("size_entry", "24");
        await activateEntryValue("letterspacing_entry", "0.5");
        await activateEntryValue("line_height_entry", "1.5");
        await userEvent.click(await findFeatureCheck("Kerning"));
        await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Reset" }));

        await waitFor(() => {
            expect(screen.getByName("size_entry")).toHaveDisplayValue("14");
            expect(screen.getByName("letterspacing_entry")).toHaveDisplayValue("0");
            expect(screen.getByName("line_height_entry")).toHaveDisplayValue("1");
            expect(screen.getByName("font-description")).toHaveTextContent("Sans 14");
        });

        const reset = await screenshot(preview);
        expect(reset.data).toBe(initial.data);
    });
});

describe("fontFeaturesDemo size entry", () => {
    it("renders a valid size through the native font description", async () => {
        await renderDemo(fontFeaturesDemo);
        const preview = await findPreview();
        const before = await screenshot(preview);
        const sizeEntry = await activateEntryValue("size_entry", "24");
        expect(sizeEntry).toHaveDisplayValue("24");

        await waitFor(() => {
            const desc = requireFontDescription(preview);
            expect(desc.getFamily()).toBe("Sans");
            expect(Pango.unitsToDouble(desc.getSize())).toBe(24);
        });

        const after = await screenshot(preview);
        expect(after.data).not.toBe(before.data);
    });

    it.each(["7", "100"])("accepts the supported %s point boundary", async (value) => {
        const sizeEntry = await commitEntryValue("size_entry", value);
        const preview = await findPreview();
        expect(sizeEntry).toHaveDisplayValue(value);
        expect(Pango.unitsToDouble(requireFontDescription(preview).getSize())).toBe(Number(value));
    });

    it("ignores out-of-range size values without crashing the preview", async () => {
        await commitEntryValue("size_entry", "9999");
        const sizeSlider = await screen.findByRole(Gtk.AccessibleRole.SLIDER, { name: "Size", as: Gtk.Scale });
        expect(sizeSlider.getValue()).toBe(14);
    });
});

describe("fontFeaturesDemo letterspacing entry", () => {
    it("converts pixel spacing to native Pango units and renders it", async () => {
        await renderDemo(fontFeaturesDemo);
        const preview = await findPreview();
        const before = await screenshot(preview);
        const letterspacingEntry = await activateEntryValue("letterspacing_entry", "0.5");
        expect(letterspacingEntry).toHaveDisplayValue("0.5");
        const spacing = requirePreviewAttribute(preview, Pango.AttrType.LETTER_SPACING).asInt();

        if (!spacing) {
            throw new Error("Invalid letter-spacing attribute");
        }

        expect(spacing.value).toBe(Pango.unitsFromDouble(0.5));
        const after = await screenshot(preview);
        expect(after.data).not.toBe(before.data);
    });

    it.each(["-1", "8"])("accepts the supported %s pixel boundary", async (value) => {
        const entry = await commitEntryValue("letterspacing_entry", value);
        expect(entry).toHaveDisplayValue(value);
        expect(await screen.findByRole(Gtk.AccessibleRole.SLIDER, { name: "Letterspacing" })).toHaveValue(
            Number(value),
        );
    });

    it("ignores spacing outside the supported range", async () => {
        await commitEntryValue("letterspacing_entry", "8.1");
        expect(await screen.findByRole(Gtk.AccessibleRole.SLIDER, { name: "Letterspacing" })).toHaveValue(0);
    });
});

describe("fontFeaturesDemo line-height entry", () => {
    it("accepts a valid line-height entry", async () => {
        const lineHeightEntry = await commitEntryValue("line_height_entry", "1.5");
        expect(lineHeightEntry).toHaveDisplayValue("1.5");
        const preview = await findPreview();
        const lineHeight = requirePreviewAttribute(preview, Pango.AttrType.LINE_HEIGHT).asFloat();

        if (!lineHeight) {
            throw new Error("Invalid line-height attribute");
        }

        expect(lineHeight.value).toBe(1.5);
    });

    it.each(["0.75", "2.5"])("accepts the supported %s line-height boundary", async (value) => {
        const entry = await commitEntryValue("line_height_entry", value);
        expect(entry).toHaveDisplayValue(value);
    });

    it("ignores invalid line-height values", async () => {
        await commitEntryValue("line_height_entry", "0.1");
        const lineHeightSlider = await screen.findByRole(Gtk.AccessibleRole.SLIDER, {
            name: "Line Height",
            as: Gtk.Scale,
        });
        expect(lineHeightSlider.getValue()).toBe(1);
    });
});

describe("fontFeaturesDemo color swap", () => {
    it("swaps the default foreground and background colors on click", async () => {
        const { fg, bg } = await renderColorButtons();
        expect(isRgbaEqual(fg, 0, 0, 0)).toBe(true);
        expect(isRgbaEqual(bg, 1, 1, 1)).toBe(true);
        const swap = await screen.findByName("swap-colors", { as: Gtk.Button });
        await userEvent.click(swap);

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
        await userEvent.click(swap);

        await waitFor(() => {
            expect(isRgbaEqual(bg, 1, 0, 0)).toBe(true);
        });
    });
});

describe("fontFeaturesDemo sliders", () => {
    it("updates the size via the Size scale and reflects it in the entry", async () => {
        await renderDemo(fontFeaturesDemo);
        const sizeSlider = await screen.findByRole(Gtk.AccessibleRole.SLIDER, { name: "Size", as: Gtk.Scale });
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

describe("fontFeaturesDemo font button", () => {
    it("changes the face through its native chooser while retaining the controlled size", async () => {
        await renderDemo(fontFeaturesDemo);
        const fontButton = await screen.findByName("font-button", { as: Gtk.FontDialogButton });
        await userEvent.click(within(fontButton).getByRole(Gtk.AccessibleRole.BUTTON));

        const dialog = await waitFor(() => {
            const windows = Gtk.Window.getToplevels();

            for (let index = 0; index < windows.getNItems(); index += 1) {
                const window = windows.getItem(index);

                if (window instanceof Gtk.Window && window.getAccessibleRole() === Gtk.AccessibleRole.DIALOG) {
                    return window;
                }
            }

            throw new Error("Missing font dialog");
        });

        const chooser = within(dialog);
        const faceName = "DejaVu Sans Mono Bold Oblique";
        const faceList = chooser.getByRole(Gtk.AccessibleRole.LIST);
        let face = chooser.queryByText(faceName);

        for (let step = 0; face === null && step < 20; step += 1) {
            await userEvent.scroll(faceList, { y: 250 });
            face = chooser.queryByText(faceName);
        }

        if (!face) {
            throw new Error("Missing DejaVu font face");
        }

        await userEvent.click(face);
        await userEvent.click(chooser.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Select" }));
        expect(await screen.findByName("font-description")).toHaveTextContent(`${faceName} 14`);

        await activateEntryValue("size_entry", "24");
        const preview = await findPreview();

        await waitFor(() => {
            const desc = requireFontDescription(preview);
            expect(desc.getFamily()).toBe("DejaVu Sans Mono");
            expect(desc.getWeight()).toBe(Pango.Weight.BOLD);
            expect(desc.getStyle()).toBe(Pango.Style.OBLIQUE);
            expect(Pango.unitsToDouble(desc.getSize())).toBe(24);
        });
    });
});

describe("fontFeaturesDemo edit mode Escape", () => {
    it("keeps edited text while native font settings change and commits it", async () => {
        await enterEditMode();
        const textView = await screen.findByName("edit_textview", { as: Gtk.TextView });
        const buffer = textView.getBuffer();
        textView.grabFocus();
        await userEvent.type(textView, "Edited ");
        await userEvent.click(await screen.findByName("size_entry", { as: Gtk.Entry }));
        const before = await screenshot(textView);
        await activateEntryValue("size_entry", "24");
        await activateEntryValue("letterspacing_entry", "0.5");
        await activateEntryValue("line_height_entry", "1.5");
        await expandFeatures();
        await userEvent.click(await findFeatureCheck("Kerning"));

        await waitFor(() => {
            const text = buffer.getText(buffer.getStartIter(), buffer.getEndIter(), false);
            expect(text).toContain("Edited ");
            expect(screen.getByName("settings")).toHaveTextContent("kern=1");
        });

        const after = await screenshot(textView);
        expect(after.data).not.toBe(before.data);

        await userEvent.click(await screen.findByName("plain_toggle", { as: Gtk.ToggleButton }));
        const preview = await findPreview();
        expect(preview.getText()).toContain("Edited ");
        expect(Pango.unitsToDouble(requireFontDescription(preview).getSize())).toBe(24);
        expect(requirePreviewAttribute(preview, Pango.AttrType.FONT_FEATURES).startIndex).toBe(0);
    });

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
