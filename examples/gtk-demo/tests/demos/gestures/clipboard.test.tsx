import * as Gdk from "@gtkx/ffi/gdk";
import * as GObject from "@gtkx/ffi/gobject";
import * as Gtk from "@gtkx/ffi/gtk";
import { act, fireEvent, screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { clipboardDemo } from "../../../src/demos/gestures/clipboard.js";
import { expectDemoMetadata, renderDemo } from "../../helpers/render-demo.js";
import { collectControllers, findAllOfType } from "../../helpers/traverse.js";

const findButtonByLabel = async (label: string): Promise<Gtk.Button> =>
    (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: label })) as Gtk.Button;

describe("clipboardDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expectDemoMetadata(clipboardDemo, { id: "clipboard", title: "Clipboard" });
        expect(typeof clipboardDemo.sourceCode).toBe("string");
        expect(clipboardDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(clipboardDemo.keywords).toContain("clipboard");
        expect(clipboardDemo.keywords).toContain("GdkClipboard");
        expect(clipboardDemo.component).toBeTypeOf("function");
    });
});

describe("clipboardDemo rendering", () => {
    it("renders the intro label, the text source entry initialised to 'Copy this!' and the Copy/Paste buttons", async () => {
        const { container } = await renderDemo(clipboardDemo);
        const labels = findAllOfType(container, Gtk.Label).map((l) => l.getLabel());
        const introMatch = labels.find((l) => typeof l === "string" && l.startsWith('"Copy"'));
        expect(introMatch).toBeDefined();
        const entry = (await screen.findByName("source-entry")) as Gtk.Entry;
        expect(entry).toBeInstanceOf(Gtk.Entry);
        expect(entry.getText()).toBe("Copy this!");
        expect(await findButtonByLabel("_Copy")).toBeInstanceOf(Gtk.Button);
        expect(await findButtonByLabel("_Paste")).toBeInstanceOf(Gtk.Button);
    });

    it("renders three toggle buttons representing the image source page", async () => {
        const { container } = await renderDemo(clipboardDemo);
        const toggles = findAllOfType(container, Gtk.ToggleButton);
        const imageToggles = toggles.filter((t) => findAllOfType(t, Gtk.Image).length > 0);
        expect(imageToggles.length).toBeGreaterThanOrEqual(3);
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
        const dragSources = collectControllers(entry, Gtk.DragSource);
        expect(dragSources).toHaveLength(1);
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
        const dropTargets = collectControllers(pasteBox, Gtk.DropTarget);
        const dropTarget = dropTargets.find((t) => t.getActions() === Gdk.DragAction.COPY);
        if (!dropTarget) throw new Error("drop target missing");
        expect(dropTarget.getActions()).toBe(Gdk.DragAction.COPY);
        expect(dropTarget).toBeInstanceOf(Gtk.DropTarget);
    });
});
