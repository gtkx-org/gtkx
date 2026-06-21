import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent, waitFor } from "@gtkx/testing";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { pickersDemo } from "../../../src/demos/dialogs/pickers.js";
import { makeFileValue, makeStringValue, renderDemo } from "../../test-utils.js";

const MIN_PDF =
    "%PDF-1.1\n%\xC2\xA5\xC2\xB1\xC3\xAB\n\n1 0 obj\n  << /Type /Catalog\n     /Pages 2 0 R\n  >>\nendobj\n\n2 0 obj\n  << /Type /Pages\n     /Kids [3 0 R]\n     /Count 1\n     /MediaBox [0 0 99 99]\n  >>\nendobj\n\n3 0 obj\n  <<  /Type /Page\n      /Parent 2 0 R\n      /Resources << >>\n      /Contents 4 0 R\n  >>\nendobj\n\n4 0 obj\n  << /Length 0 >>\nstream\nendstream\nendobj\n\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000063 00000 n\n0000000136 00000 n\n0000000221 00000 n\n\ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n264\n%%EOF\n";

let tmpDir: string;
let pdfPath: string;

beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "gtkx-pickers-"));
    pdfPath = join(tmpDir, "doc.pdf");
    writeFileSync(pdfPath, MIN_PDF);
});

afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
});

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
});

describe("pickersDemo handlers", () => {
    it("invokes the file open dialog handler when the select-file button is clicked", async () => {
        await renderDemo(pickersDemo);
        const selectFile = (await screen.findByName("select-file-button")) as Gtk.Button;
        await userEvent.click(selectFile);
        await new Promise((resolve) => setTimeout(resolve, 250));
        expect(selectFile.getSensitive()).toBe(true);
    });

    it("invokes the URI launcher handler when the 'www.gtk.org' button is clicked", async () => {
        await renderDemo(pickersDemo);
        const uri = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, {
            name: "Open www.gtk.org",
        })) as Gtk.Button;
        await userEvent.click(uri);
        await new Promise((resolve) => setTimeout(resolve, 250));
    });
});

describe("pickersDemo drop target", () => {
    it("accepts a GFile dropped on the select-file button and updates the displayed filename", async () => {
        await renderDemo(pickersDemo);
        const selectFile = (await screen.findByName("select-file-button")) as Gtk.Button;
        await userEvent.drop(selectFile, makeFileValue("/tmp"));
        await waitFor(() => {
            const tmpLabels = screen.queryAllByText("tmp");
            expect(tmpLabels.length).toBeGreaterThan(0);
        });
    });

    it("returns false from the drop handler when a non-file value is dropped on the select-file button", async () => {
        await renderDemo(pickersDemo);
        const selectFile = (await screen.findByName("select-file-button")) as Gtk.Button;
        await userEvent.drop(selectFile, makeStringValue("not a file"));
        const fileNameLabel = await screen.findByText("None");
        expect(fileNameLabel).toBeInstanceOf(Gtk.Widget);
    });

    it("enables the Open File, Open in Folder buttons once a file is dropped", async () => {
        await renderDemo(pickersDemo);
        const selectFile = (await screen.findByName("select-file-button")) as Gtk.Button;
        await userEvent.drop(selectFile, makeFileValue("/tmp"));
        const openFileBtn = (await screen.findByName("open-file-button")) as Gtk.Button;
        const openFolderBtn = (await screen.findByName("open-folder-button")) as Gtk.Button;
        await waitFor(() => expect(openFileBtn.getSensitive()).toBe(true));
        expect(openFolderBtn.getSensitive()).toBe(true);
    });
});

describe("pickersDemo file-dependent handlers", () => {
    it("invokes the launch-app handler with an actual file after dropping a GFile", async () => {
        await renderDemo(pickersDemo);
        const selectFile = (await screen.findByName("select-file-button")) as Gtk.Button;
        await userEvent.drop(selectFile, makeFileValue("/tmp"));
        const openFile = (await screen.findByName("open-file-button")) as Gtk.Button;
        await waitFor(() => expect(openFile.getSensitive()).toBe(true));
        await userEvent.click(openFile);
        await new Promise((resolve) => setTimeout(resolve, 250));
    });

    it("enables the Print button and runs handlePrintFile after dropping a PDF GFile", async () => {
        const printFileSpy = vi.spyOn(Gtk.PrintDialog.prototype, "printFile").mockResolvedValue(true);
        await renderDemo(pickersDemo);
        const selectFile = (await screen.findByName("select-file-button")) as Gtk.Button;
        await userEvent.drop(selectFile, makeFileValue(pdfPath));
        const printBtn = (await screen.findByName("print-button")) as Gtk.Button;
        await waitFor(() => expect(printBtn.getSensitive()).toBe(true));
        try {
            await userEvent.click(printBtn);
            await waitFor(() => expect(printFileSpy).toHaveBeenCalled());
        } finally {
            printFileSpy.mockRestore();
        }
    });
});
