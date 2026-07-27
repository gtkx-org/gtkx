import * as Gtk from "@gtkx/gi/gtk";
import * as Pango from "@gtkx/gi/pango";
import { act, fireEvent, screen, userEvent, waitFor, within } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { fontRenderingDemo } from "../../../src/demos/advanced/fontrendering.js";
import { renderDemo } from "../../test-utils.js";

async function activateGridMode(): Promise<Gtk.ToggleButton> {
    const gridToggle = (await screen.findByRole(Gtk.AccessibleRole.TOGGLE_BUTTON, {
        name: "Grid",
    })) as Gtk.ToggleButton;

    await userEvent.click(gridToggle);

    return gridToggle;
}

async function toggleExtentsAndGridOverlays(): Promise<{ extents: Gtk.CheckButton; grid: Gtk.CheckButton }> {
    const extents = (await screen.findByRole(Gtk.AccessibleRole.CHECKBOX, {
        name: "Show _Extents",
    })) as Gtk.CheckButton;

    const grid = (await screen.findByRole(Gtk.AccessibleRole.CHECKBOX, {
        name: "Show _Grid",
    })) as Gtk.CheckButton;

    await userEvent.click(extents);
    await userEvent.click(grid);

    return { extents, grid };
}

describe("fontRenderingDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(fontRenderingDemo.id).toBe("fontrendering");
        expect(fontRenderingDemo.title).toBe("Pango/Font Rendering");
        expect(fontRenderingDemo.description.length).toBeGreaterThan(0);
        expect(Array.isArray(fontRenderingDemo.keywords)).toBe(true);
        expect(typeof fontRenderingDemo.sourceCode).toBe("string");
        expect(fontRenderingDemo.defaultWidth).toBe(1024);
        expect(fontRenderingDemo.defaultHeight).toBe(768);
    });

    it("registers titlebar and provider components on the demo", () => {
        expect(typeof fontRenderingDemo.titlebar).toBe("function");
        expect(typeof fontRenderingDemo.provider).toBe("function");
    });
});

describe("fontRenderingDemo titlebar wiring", () => {
    it("mounts the GtkHeaderBar titlebar with Text active and Grid inactive by default", async () => {
        await renderDemo(fontRenderingDemo);
        const header = (await screen.findByName("fontrendering-header")) as Gtk.HeaderBar;
        const textToggle = within(header).getByRole(Gtk.AccessibleRole.TOGGLE_BUTTON, { name: "Text" });
        const gridToggle = within(header).getByRole(Gtk.AccessibleRole.TOGGLE_BUTTON, { name: "Grid" });
        expect(textToggle).toBePressed();
        expect(gridToggle).not.toBePressed();
    });
});

describe("fontRenderingDemo header toggles", () => {
    it("starts in text mode with the Text toggle active", async () => {
        await renderDemo(fontRenderingDemo);

        const textToggle = (await screen.findByRole(Gtk.AccessibleRole.TOGGLE_BUTTON, {
            name: "Text",
        })) as Gtk.ToggleButton;

        const gridToggle = (await screen.findByRole(Gtk.AccessibleRole.TOGGLE_BUTTON, {
            name: "Grid",
        })) as Gtk.ToggleButton;

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

        const textToggle = (await screen.findByRole(Gtk.AccessibleRole.TOGGLE_BUTTON, {
            name: "Text",
        })) as Gtk.ToggleButton;

        await userEvent.click(textToggle);
        expect(textToggle).toBePressed();
        expect(gridToggle).not.toBePressed();
    });
});

describe("fontRenderingDemo overlay checks", () => {
    it("renders pixel and outline overlay checkboxes with correct defaults", async () => {
        await renderDemo(fontRenderingDemo);

        const showPixels = (await screen.findByRole(Gtk.AccessibleRole.CHECKBOX, {
            name: "Show _Pixels",
        })) as Gtk.CheckButton;

        const showOutline = (await screen.findByRole(Gtk.AccessibleRole.CHECKBOX, {
            name: "Show _Outline",
        })) as Gtk.CheckButton;

        expect(showPixels).toBeChecked();
        expect(showOutline).not.toBeChecked();
    });

    it("toggles the show-pixels overlay state", async () => {
        await renderDemo(fontRenderingDemo);

        const showPixels = (await screen.findByRole(Gtk.AccessibleRole.CHECKBOX, {
            name: "Show _Pixels",
        })) as Gtk.CheckButton;

        await userEvent.click(showPixels);
        expect(showPixels).not.toBeChecked();
    });

    it("toggles antialias and hint-metrics checks", async () => {
        await renderDemo(fontRenderingDemo);

        const antialias = (await screen.findByRole(Gtk.AccessibleRole.CHECKBOX, {
            name: "_Antialias",
        })) as Gtk.CheckButton;

        const hintMetrics = (await screen.findByRole(Gtk.AccessibleRole.CHECKBOX, {
            name: "Hint _Metrics",
        })) as Gtk.CheckButton;

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
        const zoomIn = (await screen.findByName("up_button")) as Gtk.Button;
        const zoomOut = (await screen.findByName("down_button")) as Gtk.Button;
        expect(zoomIn).toBeInstanceOf(Gtk.Button);
        expect(zoomOut).toBeInstanceOf(Gtk.Button);
        expect(zoomIn.getSensitive()).toBe(true);
        expect(zoomOut.getSensitive()).toBe(true);
    });

    it("grows the drawing-area content width when zooming in", async () => {
        await renderDemo(fontRenderingDemo);
        const zoomIn = (await screen.findByName("up_button")) as Gtk.Button;
        const drawingArea = (await screen.findByName("image")) as Gtk.DrawingArea;
        const before = drawingArea.getContentWidth();
        await fireEvent(zoomIn, "clicked");

        await waitFor(() => {
            expect(drawingArea.getContentWidth()).toBeGreaterThan(before);
        });
    });

    it("shrinks the drawing-area content width when zooming out", async () => {
        await renderDemo(fontRenderingDemo);
        const zoomOut = (await screen.findByName("down_button")) as Gtk.Button;
        const drawingArea = (await screen.findByName("image")) as Gtk.DrawingArea;
        const before = drawingArea.getContentWidth();
        await fireEvent(zoomOut, "clicked");

        await waitFor(() => {
            expect(drawingArea.getContentWidth()).toBeLessThan(before);
        });
    });
});

describe("fontRenderingDemo text input", () => {
    it("renders an entry holding the default text", async () => {
        await renderDemo(fontRenderingDemo);
        const entry = (await screen.findByName("entry")) as Gtk.Entry;
        expect(entry).toBeInstanceOf(Gtk.Entry);
        expect(entry).toHaveDisplayValue("Fonts render");
    });

    it("updates the text state when the entry changes", async () => {
        await renderDemo(fontRenderingDemo);
        const entry = (await screen.findByName("entry")) as Gtk.Entry;
        await userEvent.clear(entry);
        await userEvent.type(entry, "Hello");
        expect(entry).toHaveDisplayValue("Hello");
    });
});

describe("fontRenderingDemo hint dropdown", () => {
    it("defaults the hint-style dropdown to the first (None) option", async () => {
        await renderDemo(fontRenderingDemo);
        const dropdown = (await screen.findByName("hinting")) as Gtk.DropDown;
        expect(dropdown.getSelected()).toBe(0);
    });
});

describe("fontRenderingDemo drawing area", () => {
    it("sizes the drawing area to the measured natural surface", async () => {
        await renderDemo(fontRenderingDemo);
        const drawingAreas = (await screen.findAllByName("image")) as Gtk.DrawingArea[];
        expect(drawingAreas).toHaveLength(1);
        const drawingArea = drawingAreas[0] as Gtk.DrawingArea;
        expect(drawingArea.getContentWidth()).toBeGreaterThan(0);
        expect(drawingArea.getContentHeight()).toBeGreaterThan(0);
    });
});

describe("fontRenderingDemo font selection", () => {
    it("re-measures the content size when a larger font is selected", async () => {
        await renderDemo(fontRenderingDemo);
        const drawingArea = (await screen.findByName("image")) as Gtk.DrawingArea;
        const before = drawingArea.getContentHeight();
        const fontButton = (await screen.findByName("font-button")) as Gtk.FontDialogButton;

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
        const dropdown = (await screen.findByName("hinting")) as Gtk.DropDown;
        await userEvent.selectOptions(dropdown, index);
        expect(dropdown.getSelected()).toBe(index);
    });
});

describe("fontRenderingDemo zoom limits", () => {
    it("desensitizes the zoom-in button once the max scale of 32 is reached", async () => {
        await renderDemo(fontRenderingDemo);
        const zoomIn = (await screen.findByName("up_button")) as Gtk.Button;

        for (let i = 0; i < 30; i++) {
            await fireEvent(zoomIn, "clicked");
        }

        await waitFor(() => {
            expect(zoomIn.getSensitive()).toBe(false);
        });
    });

    it("desensitizes the zoom-out button once the min scale of 1 is reached", async () => {
        await renderDemo(fontRenderingDemo);
        const zoomOut = (await screen.findByName("down_button")) as Gtk.Button;

        for (let i = 0; i < 10; i++) {
            await fireEvent(zoomOut, "clicked");
        }

        await waitFor(() => {
            expect(zoomOut.getSensitive()).toBe(false);
        });
    });
});

describe("fontRenderingDemo keyboard zoom shortcuts", () => {
    it("zooms in via the Ctrl+plus shortcut", async () => {
        await renderDemo(fontRenderingDemo);
        const drawingArea = (await screen.findByName("image")) as Gtk.DrawingArea;
        const before = drawingArea.getContentWidth();
        drawingArea.grabFocus();
        await userEvent.keyboard(drawingArea, "{Control>}+{/Control}");

        await waitFor(() => {
            expect(drawingArea.getContentWidth()).toBeGreaterThan(before);
        });
    });

    it("zooms out via the Ctrl+minus shortcut", async () => {
        await renderDemo(fontRenderingDemo);
        const drawingArea = (await screen.findByName("image")) as Gtk.DrawingArea;
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

        const showOutline = (await screen.findByRole(Gtk.AccessibleRole.CHECKBOX, {
            name: "Show _Outline",
        })) as Gtk.CheckButton;

        await userEvent.click(showOutline);
        expect(showOutline).toBeChecked();
        await result.unmount();
    });

    it("unchecks the Show Pixels overlay when toggled off", async () => {
        const result = await renderDemo(fontRenderingDemo);

        const showPixels = (await screen.findByRole(Gtk.AccessibleRole.CHECKBOX, {
            name: "Show _Pixels",
        })) as Gtk.CheckButton;

        await userEvent.click(showPixels);
        expect(showPixels).not.toBeChecked();
        await result.unmount();
    });
});

describe("fontRenderingDemo paint callback", () => {
    it("has a non-zero measured content size in text mode", async () => {
        await renderDemo(fontRenderingDemo);
        const drawingArea = (await screen.findByName("image")) as Gtk.DrawingArea;

        await act(() => {
            drawingArea.queueDraw();
        });

        expect(drawingArea.getContentWidth()).toBeGreaterThan(0);
        expect(drawingArea.getContentHeight()).toBeGreaterThan(0);
    });

    it("re-measures to a different content size after switching to grid mode", async () => {
        await renderDemo(fontRenderingDemo);
        const drawingArea = (await screen.findByName("image")) as Gtk.DrawingArea;
        const textSize: [number, number] = [drawingArea.getContentWidth(), drawingArea.getContentHeight()];
        await activateGridMode();

        await waitFor(() => {
            expect([drawingArea.getContentWidth(), drawingArea.getContentHeight()]).not.toEqual(textSize);
        },
        );

        expect(drawingArea.getContentWidth()).toBeGreaterThan(0);
        expect(drawingArea.getContentHeight()).toBeGreaterThan(0);
    });

    it("queues a draw after toggling extents and grid overlays so all branches are exercised", async () => {
        await renderDemo(fontRenderingDemo);
        const { extents, grid } = await toggleExtentsAndGridOverlays();
        const drawingArea = (await screen.findByName("image")) as Gtk.DrawingArea;

        await act(() => {
            drawingArea.queueDraw();
        });

        expect(extents).toBeChecked();
        expect(grid).toBeChecked();
    });
});

describe("fontRenderingDemo text entry", () => {
    it("clears the entry and accepts empty text via the change handler", async () => {
        await renderDemo(fontRenderingDemo);
        const entry = (await screen.findByName("entry")) as Gtk.Entry;
        await userEvent.clear(entry);
        expect(entry).toHaveDisplayValue("");
    });
});
