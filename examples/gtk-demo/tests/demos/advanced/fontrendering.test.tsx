import * as Gtk from "@gtkx/gi/gtk";
import * as Pango from "@gtkx/gi/pango";
import { act, screen, screenshot, userEvent, waitFor, within } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { fontRenderingDemo } from "../../../src/demos/advanced/fontrendering.js";
import { renderDemo, screenshotColors } from "../../test-utils.js";

async function findModeToggle(name: string): Promise<Gtk.ToggleButton> {
    return await screen.findByRole(Gtk.AccessibleRole.TOGGLE_BUTTON, { name, as: Gtk.ToggleButton });
}

async function findOverlayCheck(name: string): Promise<Gtk.CheckButton> {
    return await screen.findByRole(Gtk.AccessibleRole.CHECKBOX, { name, as: Gtk.CheckButton });
}

async function renderDrawingArea(): Promise<Gtk.DrawingArea> {
    await renderDemo(fontRenderingDemo);

    return await screen.findByName("image", { as: Gtk.DrawingArea });
}

async function renderEntry(): Promise<Gtk.Entry> {
    await renderDemo(fontRenderingDemo);

    return await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX, { name: "Text", as: Gtk.Entry });
}

async function activateGridMode(): Promise<Gtk.ToggleButton> {
    const gridToggle = await findModeToggle("Grid");
    await userEvent.click(gridToggle);

    return gridToggle;
}

async function toggleExtentsAndGridOverlays(): Promise<{ extents: Gtk.CheckButton; grid: Gtk.CheckButton }> {
    const extents = await findOverlayCheck("Show Extents");
    const grid = await findOverlayCheck("Show Grid");
    await userEvent.click(extents);
    await userEvent.click(grid);

    return { extents, grid };
}

describe("fontRenderingDemo titlebar wiring", () => {
    it("mounts the GtkHeaderBar titlebar with Text active and Grid inactive by default", async () => {
        await renderDemo(fontRenderingDemo);
        const header = await screen.findByName("fontrendering-header", { as: Gtk.HeaderBar });
        const textToggle = within(header).getByRole(Gtk.AccessibleRole.TOGGLE_BUTTON, { name: "Text" });
        const gridToggle = within(header).getByRole(Gtk.AccessibleRole.TOGGLE_BUTTON, { name: "Grid" });
        expect(textToggle).toBePressed();
        expect(gridToggle).not.toBePressed();
    });
});

describe("fontRenderingDemo header toggles", () => {
    it("starts in text mode with the Text toggle active", async () => {
        await renderDemo(fontRenderingDemo);
        const textToggle = await findModeToggle("Text");
        const gridToggle = await findModeToggle("Grid");
        expect(textToggle).toBePressed();
        expect(gridToggle).not.toBePressed();
    });

    it("switches to grid mode when the Grid toggle is activated", async () => {
        await renderDemo(fontRenderingDemo);
        const gridToggle = await activateGridMode();
        expect(gridToggle).toBePressed();
    });

    it("switches back to text mode when the Text toggle is re-activated from grid", async () => {
        await renderDemo(fontRenderingDemo);
        const gridToggle = await activateGridMode();
        expect(gridToggle).toBePressed();
        const textToggle = await findModeToggle("Text");
        await userEvent.click(textToggle);
        expect(textToggle).toBePressed();
        expect(gridToggle).not.toBePressed();
    });
});

describe("fontRenderingDemo overlay checks", () => {
    it("renders pixel and outline overlay checkboxes with correct defaults", async () => {
        await renderDemo(fontRenderingDemo);
        const showPixels = await findOverlayCheck("Show Pixels");
        const showOutline = await findOverlayCheck("Show Outline");
        expect(showPixels).toBeChecked();
        expect(showOutline).not.toBeChecked();
    });

    it("toggles the show-pixels overlay state", async () => {
        await renderDemo(fontRenderingDemo);
        const showPixels = await findOverlayCheck("Show Pixels");
        await userEvent.click(showPixels);
        expect(showPixels).not.toBeChecked();
    });

    it("toggles antialias and hint-metrics checks", async () => {
        await renderDemo(fontRenderingDemo);
        const antialias = await findOverlayCheck("Antialias");
        const hintMetrics = await findOverlayCheck("Hint Metrics");
        expect(antialias).toBeChecked();
        expect(hintMetrics).not.toBeChecked();
        await userEvent.click(antialias);
        await userEvent.click(hintMetrics);
        expect(antialias).not.toBeChecked();
        expect(hintMetrics).toBeChecked();
    });

    it("toggles extents and grid overlays", async () => {
        await renderDemo(fontRenderingDemo);
        const { extents, grid } = await toggleExtentsAndGridOverlays();
        expect(extents).toBeChecked();
        expect(grid).toBeChecked();
    });
});

describe("fontRenderingDemo zoom buttons", () => {
    it("renders zoom in and zoom out buttons", async () => {
        await renderDemo(fontRenderingDemo);
        const zoomIn = await screen.findByName("up_button", { as: Gtk.Button });
        const zoomOut = await screen.findByName("down_button", { as: Gtk.Button });
        expect(zoomIn).toBeEnabled();
        expect(zoomOut).toBeEnabled();
        expect(zoomIn).toAppearBefore(zoomOut);
    });

    it("grows the drawing-area content width when zooming in", async () => {
        const drawingArea = await renderDrawingArea();
        const zoomIn = await screen.findByName("up_button", { as: Gtk.Button });
        const before = drawingArea.getContentWidth();
        await userEvent.click(zoomIn);

        await waitFor(() => {
            expect(drawingArea.getContentWidth()).toBeGreaterThan(before);
        });
    });

    it("shrinks the drawing-area content width when zooming out", async () => {
        const drawingArea = await renderDrawingArea();
        const zoomOut = await screen.findByName("down_button", { as: Gtk.Button });
        const before = drawingArea.getContentWidth();
        await userEvent.click(zoomOut);

        await waitFor(() => {
            expect(drawingArea.getContentWidth()).toBeLessThan(before);
        });
    });
});

describe("fontRenderingDemo text input", () => {
    it("renders an entry holding the default text", async () => {
        const entry = await renderEntry();
        expect(entry).toBeRooted();
        expect(entry).toHaveDisplayValue("Fonts render");
    });

    it("updates the text state when the entry changes", async () => {
        const entry = await renderEntry();
        await userEvent.clear(entry);
        await userEvent.type(entry, "Hello");
        expect(entry).toHaveDisplayValue("Hello");
    });
});

describe("fontRenderingDemo hint dropdown", () => {
    it("defaults the hint-style dropdown to the first (None) option", async () => {
        await renderDemo(fontRenderingDemo);
        const dropdown = await screen.findByName("hinting", { as: Gtk.DropDown });
        expect(dropdown).toHaveObjectProperty("selected", 0);
        expect(await screen.findByLabelText("Hinting", { as: Gtk.DropDown })).toBe(dropdown);
    });
});

describe("fontRenderingDemo drawing area", () => {
    it("sizes the drawing area to the measured natural surface", async () => {
        await renderDemo(fontRenderingDemo);
        const drawingAreas = await screen.findAllByName("image", { as: Gtk.DrawingArea });
        expect(drawingAreas).toHaveLength(1);
        const drawingArea = drawingAreas[0] as Gtk.DrawingArea;
        expect(drawingArea.getContentWidth()).toBeGreaterThan(0);
        expect(drawingArea.getContentHeight()).toBeGreaterThan(0);
    });
});

describe("fontRenderingDemo font selection", () => {
    it("re-measures the content size when a larger font is selected", async () => {
        const drawingArea = await renderDrawingArea();
        const before = drawingArea.getContentHeight();
        const fontButton = await screen.findByRole(Gtk.AccessibleRole.GROUP, {
            name: "Font",
            as: Gtk.FontDialogButton,
        });

        await act(() => {
            fontButton.setFontDesc(Pango.FontDescription.fromString("Sans 48"));
        });

        await waitFor(() => {
            expect(drawingArea.getContentHeight()).toBeGreaterThan(before);
        });
    });
});

describe("fontRenderingDemo dropdown selection", () => {
    it.each([
        ["slight", 1],
        ["medium", 2],
        ["full", 3],
    ])("changes the hint-style selection to %s via userEvent.selectOptions", async (_label, index) => {
        await renderDemo(fontRenderingDemo);
        const dropdown = await screen.findByName("hinting", { as: Gtk.DropDown });
        await userEvent.selectOptions(dropdown, index);
        expect(dropdown).toHaveObjectProperty("selected", index);
    });
});

describe("fontRenderingDemo zoom limits", () => {
    it("desensitizes the zoom-in button once the max scale of 32 is reached", async () => {
        await renderDemo(fontRenderingDemo);
        const zoomIn = await screen.findByName("up_button", { as: Gtk.Button });

        while (zoomIn.getSensitive()) {
            await userEvent.click(zoomIn);
        }

        await waitFor(() => {
            expect(zoomIn).toBeDisabled();
        });
    });

    it("desensitizes the zoom-out button once the min scale of 1 is reached", async () => {
        await renderDemo(fontRenderingDemo);
        const zoomOut = await screen.findByName("down_button", { as: Gtk.Button });

        while (zoomOut.getSensitive()) {
            await userEvent.click(zoomOut);
        }

        await waitFor(() => {
            expect(zoomOut).toBeDisabled();
        });
    });
});

describe("fontRenderingDemo keyboard zoom shortcuts", () => {
    it("zooms in via the Ctrl+plus shortcut", async () => {
        const drawingArea = await renderDrawingArea();
        const before = drawingArea.getContentWidth();
        drawingArea.grabFocus();
        await userEvent.keyboard(drawingArea, "{Control>}+{/Control}");

        await waitFor(() => {
            expect(drawingArea.getContentWidth()).toBeGreaterThan(before);
        });
    });

    it("zooms out via the Ctrl+minus shortcut", async () => {
        const drawingArea = await renderDrawingArea();
        const before = drawingArea.getContentWidth();
        drawingArea.grabFocus();
        await userEvent.keyboard(drawingArea, "{Control>}-{/Control}");

        await waitFor(() => {
            expect(drawingArea.getContentWidth()).toBeLessThan(before);
        });
    });
});

describe("fontRenderingDemo overlay animation", () => {
    it("checks the Show Outline overlay when toggled on", async () => {
        const result = await renderDemo(fontRenderingDemo);
        const showOutline = await findOverlayCheck("Show Outline");
        await userEvent.click(showOutline);
        expect(showOutline).toBeChecked();
        await result.unmount();
    });

    it("unchecks the Show Pixels overlay when toggled off", async () => {
        const result = await renderDemo(fontRenderingDemo);
        const showPixels = await findOverlayCheck("Show Pixels");
        await userEvent.click(showPixels);
        expect(showPixels).not.toBeChecked();
        await result.unmount();
    });
});

describe("fontRenderingDemo paint callback", () => {
    it("paints visible glyph detail in text mode", async () => {
        const drawingArea = await renderDrawingArea();
        expect(screenshotColors(await screenshot(drawingArea)).size).toBeGreaterThan(8);
    });

    it("repaints to a different image after switching to grid mode", async () => {
        const drawingArea = await renderDrawingArea();
        const textSize: [number, number] = [drawingArea.getContentWidth(), drawingArea.getContentHeight()];
        const textImage = await screenshot(drawingArea);
        await activateGridMode();

        await waitFor(() => {
            expect([drawingArea.getContentWidth(), drawingArea.getContentHeight()]).not.toEqual(textSize);
        });

        const gridImage = await screenshot(drawingArea);
        expect(gridImage.data).not.toBe(textImage.data);
        expect(screenshotColors(gridImage).size).toBeGreaterThan(8);
    });

    it("repaints when extents and grid overlays are enabled", async () => {
        const drawingArea = await renderDrawingArea();
        const before = await screenshot(drawingArea);
        await toggleExtentsAndGridOverlays();

        await waitFor(async () => {
            const after = await screenshot(drawingArea);
            expect(after.data).not.toBe(before.data);
        });
    });
});

describe("fontRenderingDemo text entry", () => {
    it("clears the entry and accepts empty text via the change handler", async () => {
        const entry = await renderEntry();
        await userEvent.clear(entry);
        expect(entry).toHaveDisplayValue("");
    });
});
