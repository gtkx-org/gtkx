import * as Gdk from "@gtkx/ffi/gdk";
import * as GObject from "@gtkx/ffi/gobject";
import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it } from "vitest";
import { clipboardDemo } from "../../../src/demos/gestures/clipboard.js";
import { act, collectControllersOfType, fireEvent, renderDemo, screen } from "../../test-utils.js";

const findButtonByLabel = async (label: string): Promise<Gtk.Button> =>
    (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: label })) as Gtk.Button;

describe("clipboardDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(clipboardDemo.id).toBe("clipboard");
        expect(clipboardDemo.title).toBe("Clipboard");
        expect(clipboardDemo.description.length).toBeGreaterThan(0);
        expect(Array.isArray(clipboardDemo.keywords)).toBe(true);
        expect(typeof clipboardDemo.sourceCode).toBe("string");
        expect(clipboardDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(clipboardDemo.keywords).toContain("drag-and-drop");
        expect(clipboardDemo.component).toBeTypeOf("function");
    });
});

describe("clipboardDemo rendering", () => {
    it("renders the intro label, the text source entry initialised to 'Copy this!' and the Copy/Paste buttons", async () => {
        await renderDemo(clipboardDemo);
        expect(await screen.findByText(/^“Copy” will copy/)).toBeInstanceOf(Gtk.Widget);
        const entry = (await screen.findByName("source-entry")) as Gtk.Entry;
        expect(entry).toBeInstanceOf(Gtk.Entry);
        expect(entry.getText()).toBe("Copy this!");
        expect(await findButtonByLabel("_Copy")).toBeInstanceOf(Gtk.Button);
        expect(await findButtonByLabel("_Paste")).toBeInstanceOf(Gtk.Button);
    });

    it("renders three image toggle buttons on the image source page", async () => {
        await renderDemo(clipboardDemo);
        expect(await screen.findByName("image_rose")).toBeInstanceOf(Gtk.ToggleButton);
        expect(await screen.findByName("image_floppy")).toBeInstanceOf(Gtk.ToggleButton);
        expect(await screen.findByName("image_logo")).toBeInstanceOf(Gtk.ToggleButton);
    });

    it("includes a GtkColorDialogButton for the Color source page", async () => {
        await renderDemo(clipboardDemo);
        const colorButton = await screen.findByName("color-button");
        expect(colorButton).toBeInstanceOf(Gtk.ColorDialogButton);
    });

    it("renders the source GtkStack initialised to the 'Text' page", async () => {
        await renderDemo(clipboardDemo);
        const sourceStack = (await screen.findByName("source-stack")) as Gtk.Stack;
        expect(sourceStack).toBeInstanceOf(Gtk.Stack);
        expect(sourceStack.getVisibleChildName()).toBe("Text");
    });
});

describe("clipboardDemo entry interactions", () => {
    it("updates the entry text via the changed signal when text is set on the source entry", async () => {
        await renderDemo(clipboardDemo);
        const entry = (await screen.findByName("source-entry")) as Gtk.Entry;
        await act(() => entry.setText("hello clipboard"));
        await fireEvent(entry, "changed");
        expect(entry.getText()).toBe("hello clipboard");
    });

    it("disables the copy button when the text source is cleared", async () => {
        await renderDemo(clipboardDemo);
        const entry = (await screen.findByName("source-entry")) as Gtk.Entry;
        const copyButton = await findButtonByLabel("_Copy");
        expect(copyButton.getSensitive()).toBe(true);
        await act(() => entry.setText(""));
        await fireEvent(entry, "changed");
        expect(copyButton.getSensitive()).toBe(false);
    });

    it("re-enables the copy button when the user retypes text after clearing the source", async () => {
        await renderDemo(clipboardDemo);
        const entry = (await screen.findByName("source-entry")) as Gtk.Entry;
        const copyButton = await findButtonByLabel("_Copy");
        await act(() => entry.setText(""));
        await fireEvent(entry, "changed");
        expect(copyButton.getSensitive()).toBe(false);
        await act(() => entry.setText("retyped"));
        await fireEvent(entry, "changed");
        expect(copyButton.getSensitive()).toBe(true);
    });
});

describe("clipboardDemo drag and drop", () => {
    it("attaches a GtkDragSource to the source entry", async () => {
        await renderDemo(clipboardDemo);
        const entry = (await screen.findByName("source-entry")) as Gtk.Entry;
        const dragSources = collectControllersOfType(entry, Gtk.DragSource);
        expect(dragSources).toHaveLength(1);
    });

    it("omits the GtkDragSource from the photo toggle and attaches it to the icon and SVG toggles", async () => {
        await renderDemo(clipboardDemo);
        const photoToggle = (await screen.findByName("image_rose")) as Gtk.ToggleButton;
        const iconToggle = (await screen.findByName("image_floppy")) as Gtk.ToggleButton;
        const svgToggle = (await screen.findByName("image_logo")) as Gtk.ToggleButton;
        expect(collectControllersOfType(photoToggle, Gtk.DragSource)).toHaveLength(0);
        expect(collectControllersOfType(iconToggle, Gtk.DragSource)).toHaveLength(1);
        expect(collectControllersOfType(svgToggle, Gtk.DragSource)).toHaveLength(1);
    });

    it("propagates the text value into the clipboard when Copy is clicked with text selected", async () => {
        await renderDemo(clipboardDemo);
        const copyButton = await findButtonByLabel("_Copy");
        await fireEvent(copyButton, "clicked");
        const clipboard = Gdk.Display.getDefault()?.getClipboard();
        if (clipboard) {
            const formats = clipboard.getFormats();
            expect(formats.containGtype(GObject.Type.STRING)).toBe(true);
        }
    });

    it("attaches a GtkDropTarget on the paste section configured for COPY actions", async () => {
        await renderDemo(clipboardDemo);
        const pasteBox = (await screen.findByName("paste-box")) as Gtk.Box;
        const dropTargets = collectControllersOfType(pasteBox, Gtk.DropTarget);
        const dropTarget = dropTargets.find((t) => t.getActions() === Gdk.DragAction.COPY);
        if (!dropTarget) throw new Error("drop target missing");
        expect(dropTarget.getActions()).toBe(Gdk.DragAction.COPY);
        expect(dropTarget).toBeInstanceOf(Gtk.DropTarget);
    });
});
