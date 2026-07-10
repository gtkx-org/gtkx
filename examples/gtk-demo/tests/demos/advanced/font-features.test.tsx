import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent, waitFor, within } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { fontFeaturesDemo } from "../../../src/demos/advanced/font-features.js";
import { renderDemo } from "../../test-utils.js";

const expandFeatures = async (): Promise<void> => {
    const expander = await screen.findByName("features-expander");
    await userEvent.click(expander);
};

const activateKerningFeature = async (): Promise<Gtk.Label> => {
    await renderDemo(fontFeaturesDemo);
    await expandFeatures();
    const kerning = await screen.findByRole(Gtk.AccessibleRole.CHECKBOX, { name: "Kerning" });
    await userEvent.click(kerning);
    const settings = (await screen.findByName("settings")) as Gtk.Label;
    await waitFor(() => expect(settings).toHaveTextContent("kern=1"));
    return settings;
};

describe("fontFeaturesDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(fontFeaturesDemo.id).toBe("font-features");
        expect(fontFeaturesDemo.title).toBe("Pango/Font Explorer");
        expect(fontFeaturesDemo.description.length).toBeGreaterThan(0);
        expect(Array.isArray(fontFeaturesDemo.keywords)).toBe(true);
        expect(typeof fontFeaturesDemo.sourceCode).toBe("string");
        expect(fontFeaturesDemo.defaultWidth).toBe(600);
        expect(fontFeaturesDemo.defaultHeight).toBe(500);
    });
});

describe("fontFeaturesDemo rendering", () => {
    it("renders the OpenType Features expander", async () => {
        await renderDemo(fontFeaturesDemo);
        const expander = await screen.findByName("features-expander");
        expect(expander).toBeInstanceOf(Gtk.Expander);
    });

    it("renders the preview label with default paragraph sample", async () => {
        await renderDemo(fontFeaturesDemo);
        const label = (await screen.findByName("preview-label")) as Gtk.Label;
        expect(label).toHaveTextContent("Grumpy wizards");
    });

    it("renders three Slider/Entry rows for Size, Letterspacing, Line Height", async () => {
        await renderDemo(fontFeaturesDemo);
        expect(await screen.findByName("size_entry")).toBeInstanceOf(Gtk.Entry);
        expect(await screen.findByName("letterspacing_entry")).toBeInstanceOf(Gtk.Entry);
        expect(await screen.findByName("line_height_entry")).toBeInstanceOf(Gtk.Entry);
    });

    it("renders Foreground and Background color dialog buttons", async () => {
        await renderDemo(fontFeaturesDemo);
        expect(await screen.findByName("foreground-color")).toBeInstanceOf(Gtk.ColorDialogButton);
        expect(await screen.findByName("background-color")).toBeInstanceOf(Gtk.ColorDialogButton);
    });

    it("renders the settings label empty initially", async () => {
        await renderDemo(fontFeaturesDemo);
        const settings = (await screen.findByName("settings")) as Gtk.Label;
        expect(settings).not.toHaveTextContent();
    });
});

describe("fontFeaturesDemo view mode buttons", () => {
    it("renders Plain and Waterfall toggle buttons with Plain active by default", async () => {
        await renderDemo(fontFeaturesDemo);
        const plain = (await screen.findByName("plain_toggle")) as Gtk.ToggleButton;
        const waterfall = (await screen.findByName("waterfall_toggle")) as Gtk.ToggleButton;
        expect(plain).toBePressed();
        expect(waterfall).not.toBePressed();
    });

    it("switches to waterfall mode and renders multiple sized labels", async () => {
        await renderDemo(fontFeaturesDemo);
        const waterfall = (await screen.findByName("waterfall_toggle")) as Gtk.ToggleButton;
        await userEvent.click(waterfall);
        const waterfallLabels = await screen.findAllByName("waterfall-label");
        expect(waterfallLabels.length).toBeGreaterThanOrEqual(15);
    });

    it("switches back to plain mode", async () => {
        await renderDemo(fontFeaturesDemo);
        const plain = (await screen.findByName("plain_toggle")) as Gtk.ToggleButton;
        const waterfall = (await screen.findByName("waterfall_toggle")) as Gtk.ToggleButton;
        await userEvent.click(waterfall);
        await userEvent.click(plain);
        expect(plain).toBePressed();
    });

    it("switches to edit mode and shows the TextView in the stack", async () => {
        await renderDemo(fontFeaturesDemo);
        const editBtn = (await screen.findByName("edit_toggle")) as Gtk.ToggleButton;
        await userEvent.click(editBtn);
        const stack = (await screen.findByName("stack")) as Gtk.Stack;
        expect(stack.getVisibleChildName()).toBe("entry");
    });
});

describe("fontFeaturesDemo sample buttons", () => {
    it("cycles through alphabet samples on click", async () => {
        await renderDemo(fontFeaturesDemo);
        const alphabetBtn = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Alphabet" })) as Gtk.Button;
        await userEvent.click(alphabetBtn);
        const label = (await screen.findByName("preview-label")) as Gtk.Label;
        expect(label).toHaveTextContent(/[A-Z]/);
    });

    it("cycles through paragraph samples on click", async () => {
        await renderDemo(fontFeaturesDemo);
        const paragraphBtn = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Paragraph" })) as Gtk.Button;
        await screen.findByText(/Grumpy wizards/);
        await userEvent.click(paragraphBtn);
        expect(screen.queryByText(/Grumpy wizards/)).toBeNull();
    });
});

describe("fontFeaturesDemo feature toggling", () => {
    it("activates Kerning when its checkbox is toggled", async () => {
        await activateKerningFeature();
    });

    it("selects a non-default radio value to enable a feature", async () => {
        await renderDemo(fontFeaturesDemo);
        await expandFeatures();
        const liningFigures = await screen.findByRole(Gtk.AccessibleRole.CHECKBOX, { name: "Lining Figures" });
        await userEvent.click(liningFigures);
        const settings = (await screen.findByName("settings")) as Gtk.Label;
        await waitFor(() => expect(settings).toHaveTextContent("lnum=1"));
    });
});

describe("fontFeaturesDemo titlebar", () => {
    it("sets a GtkHeaderBar as the window titlebar containing the Reset button", async () => {
        await renderDemo(fontFeaturesDemo);
        const header = (await screen.findByName("font-features-header")) as Gtk.HeaderBar;
        expect(header).toBeInstanceOf(Gtk.HeaderBar);
        const resetButton = within(header).getByName("reset") as Gtk.Button;
        expect(resetButton).toBeInstanceOf(Gtk.Button);
        expect(resetButton.getIconName()).toBe("view-refresh-symbolic");
    });

    it("clicking the titlebar Reset button clears active feature settings in the body", async () => {
        const settings = await activateKerningFeature();

        const resetButton = (await screen.findByName("reset")) as Gtk.Button;
        await userEvent.click(resetButton);

        await waitFor(() => expect(settings).not.toHaveTextContent());
    });
});

describe("fontFeaturesDemo size entry", () => {
    it("accepts a valid size entry value", async () => {
        await renderDemo(fontFeaturesDemo);
        const sizeEntry = (await screen.findByName("size_entry")) as Gtk.Entry;
        await userEvent.clear(sizeEntry);
        await userEvent.type(sizeEntry, "24");
        await userEvent.keyboard(sizeEntry, "{Enter}");
        expect(sizeEntry).toHaveDisplayValue("24");
    });

    it("ignores out-of-range size values without crashing the preview", async () => {
        await renderDemo(fontFeaturesDemo);
        const sizeEntry = (await screen.findByName("size_entry")) as Gtk.Entry;
        await userEvent.clear(sizeEntry);
        await userEvent.type(sizeEntry, "9999");
        await userEvent.keyboard(sizeEntry, "{Enter}");
        const preview = (await screen.findByName("preview-label")) as Gtk.Label;
        expect(preview).toHaveTextContent();
        expect(sizeEntry).toHaveDisplayValue("9999");
    });
});

describe("fontFeaturesDemo letterspacing entry", () => {
    it("accepts a valid letterspacing entry", async () => {
        await renderDemo(fontFeaturesDemo);
        const letterspacingEntry = (await screen.findByName("letterspacing_entry")) as Gtk.Entry;
        await userEvent.clear(letterspacingEntry);
        await userEvent.type(letterspacingEntry, "512");
        await userEvent.keyboard(letterspacingEntry, "{Enter}");
        expect(letterspacingEntry).toHaveDisplayValue("512");
    });
});

describe("fontFeaturesDemo line-height entry", () => {
    it("accepts a valid line-height entry", async () => {
        await renderDemo(fontFeaturesDemo);
        const lineHeightEntry = (await screen.findByName("line_height_entry")) as Gtk.Entry;
        await userEvent.clear(lineHeightEntry);
        await userEvent.type(lineHeightEntry, "1.5");
        await userEvent.keyboard(lineHeightEntry, "{Enter}");
        expect(lineHeightEntry).toHaveDisplayValue("1.5");
    });

    it("ignores invalid line-height values", async () => {
        await renderDemo(fontFeaturesDemo);
        const lineHeightEntry = (await screen.findByName("line_height_entry")) as Gtk.Entry;
        await userEvent.clear(lineHeightEntry);
        await userEvent.type(lineHeightEntry, "0.1");
        await userEvent.keyboard(lineHeightEntry, "{Enter}");
        expect(lineHeightEntry).toHaveDisplayValue("0.1");
    });
});

describe("fontFeaturesDemo color swap", () => {
    it("renders a swap-colors button with the swap tooltip", async () => {
        await renderDemo(fontFeaturesDemo);
        const swap = (await screen.findByName("swap-colors")) as Gtk.Button;
        expect(swap.getTooltipText()).toBe("Swap colors");
        expect(swap.getIconName()).toBe("object-flip-vertical-symbolic");
        await userEvent.click(swap);
    });
});
