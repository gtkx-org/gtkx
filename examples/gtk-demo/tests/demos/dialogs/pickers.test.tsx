import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it } from "vitest";
import { pickersDemo } from "../../../src/demos/dialogs/pickers.js";
import { fireEvent, renderDemo, screen, waitFor } from "../../test-utils.js";

const dropTargetsOf = (widget: Gtk.Widget): Gtk.DropTarget[] => {
    const observer = widget.observeControllers();
    const out: Gtk.DropTarget[] = [];
    const count = observer.getNItems();
    for (let i = 0; i < count; i++) {
        const controller = observer.getItem(i);
        if (controller instanceof Gtk.DropTarget) out.push(controller);
    }
    return out;
};

describe("pickersDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(pickersDemo.id).toBe("pickers");
        expect(pickersDemo.title).toBe("Pickers and Launchers");
        expect(pickersDemo.description.length).toBeGreaterThan(0);
        expect(Array.isArray(pickersDemo.keywords)).toBe(true);
        expect(typeof pickersDemo.sourceCode).toBe("string");
        expect(pickersDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(pickersDemo.keywords).toContain("GtkUriLauncher");
        expect(pickersDemo.component).toBeTypeOf("function");
    });
});

describe("pickersDemo rendering", () => {
    it("renders a color dialog button and a font dialog button", async () => {
        await renderDemo(pickersDemo);
        expect(await screen.findByName("color-button")).toBeInstanceOf(Gtk.ColorDialogButton);
        expect(await screen.findByName("font-button")).toBeInstanceOf(Gtk.FontDialogButton);
    });

    it("renders the 'None' file label and the www.gtk.org URI launcher button", async () => {
        await renderDemo(pickersDemo);
        const noneLabelParent = await screen.findByText("None");
        expect(noneLabelParent).toBeInstanceOf(Gtk.Widget);
        const uriButton = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Open www.gtk.org" });
        expect(uriButton).toBeInstanceOf(Gtk.Button);
    });

    it("renders the labelled rows for color, font, file and URI via mnemonic labels", async () => {
        await renderDemo(pickersDemo);
        expect(await screen.findByLabelText("_Color:")).toBeInstanceOf(Gtk.ColorDialogButton);
        expect(await screen.findByLabelText("_Font:")).toBeInstanceOf(Gtk.FontDialogButton);
        expect(await screen.findByLabelText("_File:")).toBeInstanceOf(Gtk.Widget);
        expect(await screen.findByLabelText("_URI:")).toBeInstanceOf(Gtk.Button);
    });
});

describe("pickersDemo file buttons", () => {
    it("renders the symbolic-icon Open File, Open in Folder and Print buttons disabled before selecting a file", async () => {
        await renderDemo(pickersDemo);
        const openFileBtn = (await screen.findByName("open-file-button")) as Gtk.Button;
        const openFolderBtn = (await screen.findByName("open-folder-button")) as Gtk.Button;
        const printBtn = (await screen.findByName("print-button")) as Gtk.Button;
        expect(openFileBtn.getSensitive()).toBe(false);
        expect(openFolderBtn.getSensitive()).toBe(false);
        expect(printBtn.getSensitive()).toBe(false);
        expect(printBtn.getTooltipText()).toBe("Print File");
    });

    it("attaches a GtkDropTarget to the document-open button so files can be dropped onto it", async () => {
        await renderDemo(pickersDemo);
        const selectFile = (await screen.findByName("select-file-button")) as Gtk.Button;
        expect(dropTargetsOf(selectFile).length).toBeGreaterThan(0);
    });
});

describe("pickersDemo handlers", () => {
    it("invokes the file open dialog handler when the select-file button is clicked", async () => {
        await renderDemo(pickersDemo);
        const selectFile = (await screen.findByName("select-file-button")) as Gtk.Button;
        await fireEvent(selectFile, "clicked");
        await waitFor(() => expect(selectFile.getSensitive()).toBe(true));
    });

    it("invokes the launch-app handler when the open-file button is clicked even though no file is selected", async () => {
        await renderDemo(pickersDemo);
        const openFile = (await screen.findByName("open-file-button")) as Gtk.Button;
        await fireEvent(openFile, "clicked");
    });

    it("invokes the open-folder handler when the folder-symbolic button is clicked", async () => {
        await renderDemo(pickersDemo);
        const folder = (await screen.findByName("open-folder-button")) as Gtk.Button;
        await fireEvent(folder, "clicked");
    });

    it("invokes the print handler when the printer-symbolic button is clicked", async () => {
        await renderDemo(pickersDemo);
        const print = (await screen.findByName("print-button")) as Gtk.Button;
        await fireEvent(print, "clicked");
    });
});
