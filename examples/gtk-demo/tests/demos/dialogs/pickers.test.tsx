import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it } from "vitest";
import { pickersDemo } from "../../../src/demos/dialogs/pickers.js";
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

describe("pickersDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expectDemoMetadata(pickersDemo, { id: "pickers", title: "Pickers and Launchers" });
        expect(typeof pickersDemo.sourceCode).toBe("string");
        expect(pickersDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(pickersDemo.keywords).toContain("color");
        expect(pickersDemo.keywords).toContain("font");
        expect(pickersDemo.keywords).toContain("file");
        expect(pickersDemo.keywords).toContain("GtkUriLauncher");
        expect(pickersDemo.component).toBeTypeOf("function");
    });
});

describe("pickersDemo rendering", () => {
    it("renders a color dialog button and a font dialog button", async () => {
        if (!pickersDemo.component) throw new Error("pickers demo component missing");
        const { container } = await renderDemo(pickersDemo.component);
        const colors = findAllOfType(container, Gtk.ColorDialogButton);
        const fonts = findAllOfType(container, Gtk.FontDialogButton);
        expect(colors).toHaveLength(1);
        expect(fonts).toHaveLength(1);
    });

    it("renders the 'None' file label and the www.gtk.org URI launcher button", async () => {
        if (!pickersDemo.component) throw new Error("pickers demo component missing");
        const { container } = await renderDemo(pickersDemo.component);
        const labels = findAllOfType(container, Gtk.Label);
        const noneLabel = labels.find((l) => l.getLabel() === "None");
        expect(noneLabel).toBeDefined();
        const buttons = findAllOfType(container, Gtk.Button);
        const uriButton = buttons.find((b) => b.getLabel() === "www.gtk.org");
        expect(uriButton).toBeInstanceOf(Gtk.Button);
    });

    it("composes a grid with the four labelled rows for color, font, file and URI", async () => {
        if (!pickersDemo.component) throw new Error("pickers demo component missing");
        const { container } = await renderDemo(pickersDemo.component);
        const grids = findAllOfType(container, Gtk.Grid);
        expect(grids.length).toBeGreaterThanOrEqual(1);
        const labels = findAllOfType(container, Gtk.Label);
        const labelTexts = labels.map((l) => l.getLabel());
        expect(labelTexts).toEqual(expect.arrayContaining(["_Color:", "_Font:", "_File:", "_URI:"]));
    });
});

describe("pickersDemo file buttons", () => {
    it("renders the symbolic-icon Open File, Open in Folder and Print buttons disabled before selecting a file", async () => {
        if (!pickersDemo.component) throw new Error("pickers demo component missing");
        const { container } = await renderDemo(pickersDemo.component);
        const buttons = findAllOfType(container, Gtk.Button);
        const openFileBtn = buttons.find((b) => b.getIconName() === "emblem-system-symbolic");
        const openFolderBtn = buttons.find((b) => b.getIconName() === "folder-symbolic");
        const printBtn = buttons.find((b) => b.getIconName() === "printer-symbolic");
        expect(openFileBtn).toBeDefined();
        expect(openFolderBtn).toBeDefined();
        expect(printBtn).toBeDefined();
        expect(openFileBtn?.getSensitive()).toBe(false);
        expect(openFolderBtn?.getSensitive()).toBe(false);
        expect(printBtn?.getSensitive()).toBe(false);
        expect(printBtn?.getTooltipText()).toBe("Print file");
    });

    it("attaches a GtkDropTarget to the document-open button so files can be dropped onto it", async () => {
        if (!pickersDemo.component) throw new Error("pickers demo component missing");
        const { container } = await renderDemo(pickersDemo.component);
        const buttons = findAllOfType(container, Gtk.Button);
        const selectFile = buttons.find((b) => b.getIconName() === "document-open-symbolic");
        if (!selectFile) throw new Error("expected select file button");
        const controllers = selectFile.observeControllers();
        let foundDropTarget = false;
        for (let i = 0; i < controllers.getNItems(); i++) {
            const controller = controllers.getItem(i);
            if (controller instanceof Gtk.DropTarget) {
                foundDropTarget = true;
                break;
            }
        }
        expect(foundDropTarget).toBe(true);
    });
});
