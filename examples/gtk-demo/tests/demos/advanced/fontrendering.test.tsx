import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it } from "vitest";
import { fontRenderingDemo } from "../../../src/demos/advanced/fontrendering.js";
import { act, fireEvent, renderDemo, screen } from "../../test-utils.js";

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
        const { window } = await renderDemo(fontRenderingDemo);
        const win = window.current;
        if (!win) throw new Error("expected window ref");
        const titlebar = win.getTitlebar?.();
        if (!titlebar) throw new Error("titlebar missing");
        expect(titlebar).toBeInstanceOf(Gtk.HeaderBar);
        const textToggle = (await screen.findByRole(Gtk.AccessibleRole.TOGGLE_BUTTON, {
            name: "Text",
        })) as Gtk.ToggleButton;
        const gridToggle = (await screen.findByRole(Gtk.AccessibleRole.TOGGLE_BUTTON, {
            name: "Grid",
        })) as Gtk.ToggleButton;
        expect(textToggle).toBeInstanceOf(Gtk.ToggleButton);
        expect(gridToggle).toBeInstanceOf(Gtk.ToggleButton);
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
        await act(() => showPixels.setActive(false));
        await fireEvent(showPixels, "toggled");
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

        await act(() => antialias.setActive(false));
        await fireEvent(antialias, "toggled");
        await act(() => hintMetrics.setActive(true));
        await fireEvent(hintMetrics, "toggled");

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
        await act(() => extents.setActive(true));
        await fireEvent(extents, "toggled");
        await act(() => grid.setActive(true));
        await fireEvent(grid, "toggled");
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
        await fireEvent(zoomIn, "clicked");
        expect(zoomIn.getSensitive()).toBe(true);
    });

    it("invokes zoom out on click without disabling immediately", async () => {
        await renderDemo(fontRenderingDemo);
        const zoomOut = (await screen.findByName("down_button")) as Gtk.Button;
        await fireEvent(zoomOut, "clicked");
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
        await act(() => entry.setText("Hello"));
        await fireEvent(entry, "changed");
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
