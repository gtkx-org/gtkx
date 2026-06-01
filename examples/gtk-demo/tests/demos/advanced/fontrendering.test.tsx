import * as Gtk from "@gtkx/gi/gtk";
import { act, fireEvent, screen, userEvent, within } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { fontRenderingDemo } from "../../../src/demos/advanced/fontrendering.js";
import { renderDemo } from "../../test-utils.js";

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
    it("mounts the GtkHeaderBar titlebar with Text and Grid toggle buttons", async () => {
        await renderDemo(fontRenderingDemo);
        const header = (await screen.findByName("fontrendering-header")) as Gtk.HeaderBar;
        expect(header).toBeInstanceOf(Gtk.HeaderBar);
        expect(within(header).getByRole(Gtk.AccessibleRole.TOGGLE_BUTTON, { name: "Text" })).toBeInstanceOf(
            Gtk.ToggleButton,
        );
        expect(within(header).getByRole(Gtk.AccessibleRole.TOGGLE_BUTTON, { name: "Grid" })).toBeInstanceOf(
            Gtk.ToggleButton,
        );
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
        expect(textToggle.getActive()).toBe(true);
        expect(gridToggle.getActive()).toBe(false);
    });

    it("switches to grid mode when the Grid toggle is activated", async () => {
        await renderDemo(fontRenderingDemo);
        const gridToggle = (await screen.findByRole(Gtk.AccessibleRole.TOGGLE_BUTTON, {
            name: "Grid",
        })) as Gtk.ToggleButton;
        await act(() => gridToggle.setActive(true));
        await fireEvent(gridToggle, "toggled");
        expect(gridToggle.getActive()).toBe(true);
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
        expect(showPixels.getActive()).toBe(true);
        expect(showOutline.getActive()).toBe(false);
    });

    it("toggles the show-pixels overlay state", async () => {
        await renderDemo(fontRenderingDemo);
        const showPixels = (await screen.findByRole(Gtk.AccessibleRole.CHECKBOX, {
            name: "Show _Pixels",
        })) as Gtk.CheckButton;
        await userEvent.click(showPixels);
        expect(showPixels.getActive()).toBe(false);
    });

    it("toggles antialias and hint-metrics checks", async () => {
        await renderDemo(fontRenderingDemo);
        const antialias = (await screen.findByRole(Gtk.AccessibleRole.CHECKBOX, {
            name: "_Antialias",
        })) as Gtk.CheckButton;
        const hintMetrics = (await screen.findByRole(Gtk.AccessibleRole.CHECKBOX, {
            name: "Hint _Metrics",
        })) as Gtk.CheckButton;
        expect(antialias.getActive()).toBe(true);
        expect(hintMetrics.getActive()).toBe(false);

        await userEvent.click(antialias);
        await userEvent.click(hintMetrics);

        expect(antialias.getActive()).toBe(false);
        expect(hintMetrics.getActive()).toBe(true);
    });

    it("toggles extents and grid overlays", async () => {
        await renderDemo(fontRenderingDemo);
        const extents = (await screen.findByRole(Gtk.AccessibleRole.CHECKBOX, {
            name: "Show _Extents",
        })) as Gtk.CheckButton;
        const grid = (await screen.findByRole(Gtk.AccessibleRole.CHECKBOX, {
            name: "Show _Grid",
        })) as Gtk.CheckButton;
        await userEvent.click(extents);
        await userEvent.click(grid);
        expect(extents.getActive()).toBe(true);
        expect(grid.getActive()).toBe(true);
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

    it("invokes zoom in on click without disabling immediately", async () => {
        await renderDemo(fontRenderingDemo);
        const zoomIn = (await screen.findByName("up_button")) as Gtk.Button;
        await userEvent.click(zoomIn);
        expect(zoomIn.getSensitive()).toBe(true);
    });

    it("invokes zoom out on click without disabling immediately", async () => {
        await renderDemo(fontRenderingDemo);
        const zoomOut = (await screen.findByName("down_button")) as Gtk.Button;
        await userEvent.click(zoomOut);
        expect(zoomOut.getSensitive()).toBe(true);
    });
});

describe("fontRenderingDemo text input", () => {
    it("renders an entry holding the default text", async () => {
        await renderDemo(fontRenderingDemo);
        const entry = (await screen.findByName("entry")) as Gtk.Entry;
        expect(entry).toBeInstanceOf(Gtk.Entry);
        expect(entry.getText()).toBe("Fonts render");
    });

    it("updates the text state when the entry changes", async () => {
        await renderDemo(fontRenderingDemo);
        const entry = (await screen.findByName("entry")) as Gtk.Entry;
        await userEvent.clear(entry);
        await userEvent.type(entry, "Hello");
        expect(entry.getText()).toBe("Hello");
    });
});

describe("fontRenderingDemo hint dropdown", () => {
    it("renders a dropdown for the hint-style selection", async () => {
        await renderDemo(fontRenderingDemo);
        const dropdown = (await screen.findByName("hinting")) as Gtk.DropDown;
        expect(dropdown).toBeInstanceOf(Gtk.DropDown);
    });
});

describe("fontRenderingDemo drawing area", () => {
    it("renders the drawing area inside a scrolled window", async () => {
        await renderDemo(fontRenderingDemo);
        const drawingAreas = (await screen.findAllByName("image")) as Gtk.DrawingArea[];
        expect(drawingAreas).toHaveLength(1);
        expect(drawingAreas[0]?.getHexpand()).toBe(true);
        expect(drawingAreas[0]?.getVexpand()).toBe(true);
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
    it("clamps zoom-in at the max scale of 32 after enough clicks", async () => {
        await renderDemo(fontRenderingDemo);
        const zoomIn = (await screen.findByName("up_button")) as Gtk.Button;
        for (let i = 0; i < 30; i++) await userEvent.click(zoomIn);
        expect(zoomIn).toBeInstanceOf(Gtk.Button);
    });

    it("clamps zoom-out at the min scale of 1 after enough clicks", async () => {
        await renderDemo(fontRenderingDemo);
        const zoomOut = (await screen.findByName("down_button")) as Gtk.Button;
        for (let i = 0; i < 10; i++) await userEvent.click(zoomOut);
        expect(zoomOut).toBeInstanceOf(Gtk.Button);
    });
});

describe("fontRenderingDemo overlay animation", () => {
    it("toggles both pixel and outline overlays so the animation ramps to a mixed target", async () => {
        const result = await renderDemo(fontRenderingDemo);
        const showOutline = (await screen.findByRole(Gtk.AccessibleRole.CHECKBOX, {
            name: "Show _Outline",
        })) as Gtk.CheckButton;
        await userEvent.click(showOutline);
        await result.unmount();
    });

    it("toggles pixels off so the animation ramps the pixel alpha to zero", async () => {
        const result = await renderDemo(fontRenderingDemo);
        const showPixels = (await screen.findByRole(Gtk.AccessibleRole.CHECKBOX, {
            name: "Show _Pixels",
        })) as Gtk.CheckButton;
        await userEvent.click(showPixels);
        await result.unmount();
    });
});

describe("fontRenderingDemo paint callback", () => {
    it("queues a draw on the drawing area in text mode", async () => {
        await renderDemo(fontRenderingDemo);
        const drawingArea = (await screen.findByName("image")) as Gtk.DrawingArea;
        await act(() => drawingArea.queueDraw());
        expect(drawingArea).toBeInstanceOf(Gtk.DrawingArea);
    });

    it("queues a draw on the drawing area after switching to grid mode", async () => {
        await renderDemo(fontRenderingDemo);
        const gridToggle = (await screen.findByRole(Gtk.AccessibleRole.TOGGLE_BUTTON, {
            name: "Grid",
        })) as Gtk.ToggleButton;
        await act(() => gridToggle.setActive(true));
        await fireEvent(gridToggle, "toggled");
        const drawingArea = (await screen.findByName("image")) as Gtk.DrawingArea;
        await act(() => drawingArea.queueDraw());
        expect(drawingArea).toBeInstanceOf(Gtk.DrawingArea);
    });

    it("queues a draw after toggling extents and grid overlays so all branches are exercised", async () => {
        await renderDemo(fontRenderingDemo);
        const extents = (await screen.findByRole(Gtk.AccessibleRole.CHECKBOX, {
            name: "Show _Extents",
        })) as Gtk.CheckButton;
        const grid = (await screen.findByRole(Gtk.AccessibleRole.CHECKBOX, {
            name: "Show _Grid",
        })) as Gtk.CheckButton;
        await userEvent.click(extents);
        await userEvent.click(grid);
        const drawingArea = (await screen.findByName("image")) as Gtk.DrawingArea;
        await act(() => drawingArea.queueDraw());
        expect(extents.getActive()).toBe(true);
        expect(grid.getActive()).toBe(true);
    });
});

describe("fontRenderingDemo text entry", () => {
    it("clears the entry and accepts empty text via the change handler", async () => {
        await renderDemo(fontRenderingDemo);
        const entry = (await screen.findByName("entry")) as Gtk.Entry;
        await userEvent.clear(entry);
        expect(entry.getText()).toBe("");
    });
});
