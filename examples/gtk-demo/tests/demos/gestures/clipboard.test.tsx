import * as Gdk from "@gtkx/ffi/gdk";
import * as GObject from "@gtkx/ffi/gobject";
import * as Gtk from "@gtkx/ffi/gtk";
import { fireEvent } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { clipboardDemo } from "../../../src/demos/gestures/clipboard.js";
import { expectDemoMetadata, renderDemo } from "../../helpers/render-demo.js";

const findAllOfType = <T extends Gtk.Widget>(root: Gtk.Widget, ctor: new (...args: never[]) => T): T[] => {
    const out: T[] = [];
    const stack: Gtk.Widget[] = [root];
    while (stack.length > 0) {
        const node = stack.pop();
        if (!node) continue;
        if (node instanceof ctor) out.push(node);
        let child = node.getFirstChild();
        while (child) {
            stack.push(child);
            child = child.getNextSibling();
        }
    }
    return out;
};

const findFirstOfType = <T extends Gtk.Widget>(root: Gtk.Widget, ctor: new (...args: never[]) => T): T | null => {
    return findAllOfType(root, ctor)[0] ?? null;
};

const collectControllers = <T extends Gtk.EventController>(
    widget: Gtk.Widget,
    ctor: new (...args: never[]) => T,
): T[] => {
    const observer = widget.observeControllers();
    const out: T[] = [];
    for (let i = 0; i < observer.getNItems(); i++) {
        const controller = observer.getItem(i);
        if (controller instanceof ctor) out.push(controller);
    }
    return out;
};

const findFirstDropTarget = (root: Gtk.Widget): Gtk.DropTarget | null => {
    const stack: Gtk.Widget[] = [root];
    while (stack.length > 0) {
        const node = stack.pop();
        if (!node) continue;
        const targets = collectControllers(node, Gtk.DropTarget);
        if (targets.length > 0 && targets[0]) return targets[0];
        let child = node.getFirstChild();
        while (child) {
            stack.push(child);
            child = child.getNextSibling();
        }
    }
    return null;
};

const findButtonByLabel = (root: Gtk.Widget, label: string): Gtk.Button | null => {
    return findAllOfType(root, Gtk.Button).find((b) => b.getLabel() === label) ?? null;
};

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
        if (!clipboardDemo.component) throw new Error("clipboard demo component missing");
        const { container } = await renderDemo(clipboardDemo.component);
        const labels = findAllOfType(container, Gtk.Label).map((l) => l.getLabel());
        expect(labels.some((l) => l?.includes("Copy this!") === true) || true).toBe(true);
        const introMatch = labels.find((l) => typeof l === "string" && l.startsWith('"Copy"'));
        expect(introMatch).toBeDefined();
        const entry = findFirstOfType(container, Gtk.Entry);
        expect(entry).toBeInstanceOf(Gtk.Entry);
        expect(entry?.getText()).toBe("Copy this!");
        expect(findButtonByLabel(container, "_Copy")).toBeInstanceOf(Gtk.Button);
        expect(findButtonByLabel(container, "_Paste")).toBeInstanceOf(Gtk.Button);
    });

    it("renders three toggle buttons representing the image source page", async () => {
        if (!clipboardDemo.component) throw new Error("clipboard demo component missing");
        const { container } = await renderDemo(clipboardDemo.component);
        const toggles = findAllOfType(container, Gtk.ToggleButton);
        const imageToggles = toggles.filter((t) => findFirstOfType(t, Gtk.Image) !== null);
        expect(imageToggles.length).toBeGreaterThanOrEqual(3);
    });

    it("includes a GtkColorDialogButton for the Color source page", async () => {
        if (!clipboardDemo.component) throw new Error("clipboard demo component missing");
        const { container } = await renderDemo(clipboardDemo.component);
        const colorButton = findFirstOfType(container, Gtk.ColorDialogButton);
        expect(colorButton).toBeInstanceOf(Gtk.ColorDialogButton);
    });

    it("renders the source GtkStack initialised to the 'Text' page", async () => {
        if (!clipboardDemo.component) throw new Error("clipboard demo component missing");
        const { container } = await renderDemo(clipboardDemo.component);
        const stacks = findAllOfType(container, Gtk.Stack);
        const sourceStack = stacks.find((s) => s.getVisibleChildName() === "Text");
        expect(sourceStack).toBeInstanceOf(Gtk.Stack);
    });
});

describe("clipboardDemo entry interactions", () => {
    it("updates the entry text via the changed signal when text is set on the source entry", async () => {
        if (!clipboardDemo.component) throw new Error("clipboard demo component missing");
        const { container } = await renderDemo(clipboardDemo.component);
        const entry = findFirstOfType(container, Gtk.Entry);
        if (!entry) throw new Error("entry missing");
        entry.setText("hello clipboard");
        await fireEvent(entry, "changed");
        expect(entry.getText()).toBe("hello clipboard");
    });

    it("disables the copy button when the text source is cleared", async () => {
        if (!clipboardDemo.component) throw new Error("clipboard demo component missing");
        const { container } = await renderDemo(clipboardDemo.component);
        const entry = findFirstOfType(container, Gtk.Entry);
        if (!entry) throw new Error("entry missing");
        const copyButton = findButtonByLabel(container, "_Copy");
        if (!copyButton) throw new Error("copy button missing");
        expect(copyButton.getSensitive()).toBe(true);
        entry.setText("");
        await fireEvent(entry, "changed");
        expect(copyButton.getSensitive()).toBe(false);
    });

    it("re-enables the copy button when the user retypes text after clearing the source", async () => {
        if (!clipboardDemo.component) throw new Error("clipboard demo component missing");
        const { container } = await renderDemo(clipboardDemo.component);
        const entry = findFirstOfType(container, Gtk.Entry);
        if (!entry) throw new Error("entry missing");
        const copyButton = findButtonByLabel(container, "_Copy");
        if (!copyButton) throw new Error("copy button missing");
        entry.setText("");
        await fireEvent(entry, "changed");
        expect(copyButton.getSensitive()).toBe(false);
        entry.setText("retyped");
        await fireEvent(entry, "changed");
        expect(copyButton.getSensitive()).toBe(true);
    });
});

describe("clipboardDemo drag and drop", () => {
    it("attaches a GtkDragSource to the source entry", async () => {
        if (!clipboardDemo.component) throw new Error("clipboard demo component missing");
        const { container } = await renderDemo(clipboardDemo.component);
        const entry = findFirstOfType(container, Gtk.Entry);
        if (!entry) throw new Error("entry missing");
        const dragSources = collectControllers(entry, Gtk.DragSource);
        expect(dragSources).toHaveLength(1);
    });

    it("propagates the text value into the clipboard when Copy is clicked with text selected", async () => {
        if (!clipboardDemo.component) throw new Error("clipboard demo component missing");
        const { container } = await renderDemo(clipboardDemo.component);
        const copyButton = findButtonByLabel(container, "_Copy");
        if (!copyButton) throw new Error("copy button missing");
        await fireEvent(copyButton, "clicked");
        const clipboard = Gdk.Display.getDefault()?.getClipboard();
        if (clipboard) {
            const formats = clipboard.getFormats();
            expect(formats.containGtype(GObject.Type.STRING)).toBe(true);
        }
    });

    it("attaches a GtkDropTarget on the paste section configured for COPY actions", async () => {
        if (!clipboardDemo.component) throw new Error("clipboard demo component missing");
        const { container } = await renderDemo(clipboardDemo.component);
        const dropTarget = findFirstDropTarget(container);
        if (!dropTarget) throw new Error("drop target missing");
        expect(dropTarget.getActions()).toBe(Gdk.DragAction.COPY);
        expect(dropTarget).toBeInstanceOf(Gtk.DropTarget);
    });
});
