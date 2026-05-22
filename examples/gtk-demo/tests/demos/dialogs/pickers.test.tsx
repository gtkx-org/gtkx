import * as Gtk from "@gtkx/ffi/gtk";
import { fireEvent, screen, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { pickersDemo } from "../../../src/demos/dialogs/pickers.js";
import { expectDemoMetadata, renderDemo } from "../../helpers/render-demo.js";
import { collectControllers, findAllOfType } from "../../helpers/traverse.js";

describe("pickersDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expectDemoMetadata(pickersDemo, { id: "pickers", title: "Pickers and Launchers" });
        expect(typeof pickersDemo.sourceCode).toBe("string");
        expect(pickersDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(pickersDemo.keywords).toContain("gtkurilauncher");
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
        const { container } = await renderDemo(pickersDemo);
        const labels = findAllOfType(container, Gtk.Label);
        const noneLabel = labels.find((l) => l.getLabel() === "None");
        expect(noneLabel).toBeDefined();
        const uriButton = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "www.gtk.org" });
        expect(uriButton).toBeInstanceOf(Gtk.Button);
    });

    it("composes a grid with the four labelled rows for color, font, file and URI", async () => {
        const { container } = await renderDemo(pickersDemo);
        const grids = findAllOfType(container, Gtk.Grid);
        expect(grids.length).toBeGreaterThanOrEqual(1);
        const labels = findAllOfType(container, Gtk.Label);
        const labelTexts = labels.map((l) => l.getLabel());
        expect(labelTexts).toEqual(expect.arrayContaining(["_Color:", "_Font:", "_File:", "_URI:"]));
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
        expect(printBtn.getTooltipText()).toBe("Print file");
    });

    it("attaches a GtkDropTarget to the document-open button so files can be dropped onto it", async () => {
        await renderDemo(pickersDemo);
        const selectFile = (await screen.findByName("select-file-button")) as Gtk.Button;
        const dropTargets = collectControllers(selectFile, Gtk.DropTarget);
        expect(dropTargets.length).toBeGreaterThan(0);
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
