import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent, waitFor } from "@gtkx/testing";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";
import { pickersDemo } from "../../../src/demos/dialogs/pickers.js";
import { makeDialogDismissedError, makeFileValue, makeStringValue, renderDemo } from "../../test-utils.js";

const MIN_PDF =
    "%PDF-1.1\n%\u{C2}\u{A5}\u{C2}\u{B1}\u{C3}\u{AB}\n\n" +
    "1 0 obj\n  << /Type /Catalog\n     /Pages 2 0 R\n  >>\nendobj\n\n" +
    "2 0 obj\n  << /Type /Pages\n     /Kids [3 0 R]\n     /Count 1\n" +
    "     /MediaBox [0 0 99 99]\n  >>\nendobj\n\n" +
    "3 0 obj\n  <<  /Type /Page\n      /Parent 2 0 R\n      /Resources << >>\n" +
    "      /Contents 4 0 R\n  >>\nendobj\n\n" +
    "4 0 obj\n  << /Length 0 >>\nstream\nendstream\nendobj\n\n" +
    "xref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000063 00000 n\n" +
    "0000000136 00000 n\n0000000221 00000 n\n\n" +
    "trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n264\n%%EOF\n";

const TMP_DIR = mkdtempSync(join(tmpdir(), "gtkx-pickers-"));
const PDF_PATH = join(TMP_DIR, "doc.pdf");

const renderSelectFileButton = async (): Promise<Gtk.Button> => {
    await renderDemo(pickersDemo);

    return await screen.findByName("select-file-button", { as: Gtk.Button });
};

const dropFileOnSelectButton = async (path: string): Promise<Gtk.Button> => {
    const selectFile = await renderSelectFileButton();
    await userEvent.drop(selectFile, makeFileValue(path));

    return selectFile;
};

writeFileSync(PDF_PATH, MIN_PDF);

afterAll(() => {
    rmSync(TMP_DIR, { recursive: true, force: true });
});

describe("pickersDemo rendering", () => {
    it("renders a color dialog button and a font dialog button", async () => {
        await renderDemo(pickersDemo);
        const colorButton = await screen.findByName("color-button", { as: Gtk.ColorDialogButton });
        const fontButton = await screen.findByName("font-button", { as: Gtk.FontDialogButton });
        expect(colorButton.getDialog()).not.toBeNull();
        expect(fontButton.getDialog()).not.toBeNull();
    });

    it("renders the 'None' file label and the www.gtk.org URI launcher button", async () => {
        await renderDemo(pickersDemo);
        expect(await screen.findByText("None")).toHaveTextContent("None");
        const uriButton = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "URI:" });
        expect(uriButton).toHaveTextContent("www.gtk.org");
    });

    it("renders the labelled rows for color, font, file and URI via mnemonic labels", async () => {
        await renderDemo(pickersDemo);
        expect(await screen.findByLabelText("Color:")).toBe(await screen.findByName("color-button"));
        expect(await screen.findByLabelText("Font:")).toBe(await screen.findByName("font-button"));
        expect(await screen.findByLabelText("File:")).toBe(await screen.findByName("select-file-button"));
        expect(await screen.findByLabelText("URI:")).toHaveTextContent("www.gtk.org");
    });
});

describe("pickersDemo file buttons", () => {
    it(
        "renders the symbolic-icon Open File, Open in Folder and Print buttons disabled before selecting a file",
        async () => {
            await renderDemo(pickersDemo);
            const selectFileBtn = await screen.findByName("select-file-button", { as: Gtk.Button });
            const openFileBtn = await screen.findByName("open-file-button", { as: Gtk.Button });
            const openFolderBtn = await screen.findByName("open-folder-button", { as: Gtk.Button });
            const printBtn = await screen.findByName("print-button", { as: Gtk.Button });
            expect(openFileBtn).toBeDisabled();
            expect(openFolderBtn).toBeDisabled();
            expect(printBtn).toBeDisabled();
            expect(selectFileBtn).toHaveAccessibleDescription("Select File");
            expect(openFileBtn).toHaveAccessibleDescription("Open File");
            expect(openFolderBtn).toHaveAccessibleDescription("Open in Folder");
            expect(printBtn).toHaveAccessibleDescription("Print File");
        },
    );
});

describe("pickersDemo handlers", () => {
    it("selects a PDF through the file dialog and enables printing", async () => {
        const open = vi.spyOn(Gtk.FileDialog.prototype, "open").mockResolvedValue(Gio.File.newForPath(PDF_PATH));

        try {
            await userEvent.click(await renderSelectFileButton());
            expect(await screen.findByText("doc.pdf")).toBeVisible();
            expect(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Print File" })).toBeEnabled();
        } finally {
            open.mockRestore();
        }
    });

    it("opens a FileDialog when the select-file button is clicked and ignores a dismissal", async () => {
        const openSpy = vi.spyOn(Gtk.FileDialog.prototype, "open").mockRejectedValue(makeDialogDismissedError());

        try {
            const selectFile = await renderSelectFileButton();
            await userEvent.click(selectFile);

            await waitFor(() => {
                expect(openSpy).toHaveBeenCalled();
            });
            expect(await screen.findByText("None")).toBeVisible();
            expect(await screen.findByName("open-file-button")).toBeDisabled();
        } finally {
            openSpy.mockRestore();
        }
    });

    it("launches the https://www.gtk.org URI when the 'www.gtk.org' button is clicked", async () => {
        const launchSpy = vi.spyOn(Gtk.UriLauncher.prototype, "launch").mockResolvedValue(true);

        try {
            await renderDemo(pickersDemo);

            const uri = await screen.findByRole(Gtk.AccessibleRole.BUTTON, {
                name: "URI:",
                as: Gtk.Button,
            });

            await userEvent.click(uri);

            await waitFor(() => {
                expect(launchSpy).toHaveBeenCalled();
            });

            const launcher = launchSpy.mock.contexts[0] as Gtk.UriLauncher | undefined;
            expect(launcher?.getUri()).toBe("https://www.gtk.org");
        } finally {
            launchSpy.mockRestore();
        }
    });

    it("keeps a pending file selection when another launcher fails", async () => {
        const info = Gio.File.newForPath(PDF_PATH).queryInfo(
            "standard::content-type",
            Gio.FileQueryInfoFlags.NONE,
            null,
        );
        const metadata = Promise.withResolvers<Gio.FileInfo>();
        const file = Gio.File.newForPath(PDF_PATH);
        const open = vi.spyOn(Gtk.FileDialog.prototype, "open").mockResolvedValue(file);
        const queryInfo = vi.spyOn(file, "queryInfoAsync").mockReturnValue(metadata.promise);
        const launch = vi.spyOn(Gtk.UriLauncher.prototype, "launch").mockRejectedValue(new Error("launch failed"));

        try {
            await userEvent.click(await renderSelectFileButton());
            await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "URI:" }));
            expect(await screen.findByRole(Gtk.AccessibleRole.ALERT_DIALOG)).toBeRooted();
            await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "OK" }));
            metadata.resolve(info);
            expect(await screen.findByText("doc.pdf")).toBeVisible();
        } finally {
            open.mockRestore();
            queryInfo.mockRestore();
            launch.mockRestore();
        }
    });
});

describe("pickersDemo drop target", () => {
    it("preserves the selected file when a dropped file cannot be read", async () => {
        const selectFile = await dropFileOnSelectButton(PDF_PATH);
        await screen.findByText("doc.pdf");
        await userEvent.drop(selectFile, makeFileValue(join(TMP_DIR, "missing.pdf")));
        expect(await screen.findByRole(Gtk.AccessibleRole.ALERT_DIALOG)).toBeRooted();
        await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "OK" }));
        expect(await screen.findByText("doc.pdf")).toBeVisible();
        expect(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Print File" })).toBeEnabled();
    });

    it("accepts a GFile dropped on the select-file button and updates the displayed filename", async () => {
        await dropFileOnSelectButton("/tmp");

        await waitFor(() => {
            expect(screen.getByText("tmp")).toHaveTextContent("tmp");
        });

        expect(screen.queryByText("None")).toBeNull();
    });

    it("returns false from the drop handler when a non-file value is dropped on the select-file button", async () => {
        const selectFile = await renderSelectFileButton();
        await userEvent.drop(selectFile, makeStringValue("not a file"));
        await screen.findByText("None");
        expect(screen.queryByText("not a file")).toBeNull();
    });

    it("enables the Open File and Open in Folder buttons but keeps Print disabled for a non-PDF file", async () => {
        await dropFileOnSelectButton("/tmp");
        const openFileBtn = await screen.findByName("open-file-button", { as: Gtk.Button });
        const openFolderBtn = await screen.findByName("open-folder-button", { as: Gtk.Button });
        const printBtn = await screen.findByName("print-button", { as: Gtk.Button });

        await waitFor(() => {
            expect(openFileBtn).toBeEnabled();
        });

        expect(openFolderBtn).toBeEnabled();
        expect(printBtn).toBeDisabled();
    });
});

describe("pickersDemo file-dependent handlers", () => {
    it("launches the dropped file via FileLauncher.launch when Open File is clicked", async () => {
        const launchSpy = vi.spyOn(Gtk.FileLauncher.prototype, "launch").mockResolvedValue(true);

        try {
            await dropFileOnSelectButton(PDF_PATH);
            const openFile = await screen.findByName("open-file-button", { as: Gtk.Button });

            await waitFor(() => {
                expect(openFile).toBeEnabled();
            });

            await userEvent.click(openFile);

            await waitFor(() => {
                expect(launchSpy).toHaveBeenCalled();
            });
        } finally {
            launchSpy.mockRestore();
        }
    });

    it("opens the containing folder via FileLauncher.openContainingFolder when Open in Folder is clicked", async () => {
        const folderSpy = vi.spyOn(Gtk.FileLauncher.prototype, "openContainingFolder").mockResolvedValue(true);

        try {
            await dropFileOnSelectButton(PDF_PATH);
            const openFolder = await screen.findByName("open-folder-button", { as: Gtk.Button });

            await waitFor(() => {
                expect(openFolder).toBeEnabled();
            });

            await userEvent.click(openFolder);

            await waitFor(() => {
                expect(folderSpy).toHaveBeenCalled();
            });
        } finally {
            folderSpy.mockRestore();
        }
    });
});

describe("pickersDemo printing", () => {
    it("enables the Print button and runs handlePrintFile after dropping a PDF GFile", async () => {
        const printFileSpy = vi.spyOn(Gtk.PrintDialog.prototype, "printFile").mockResolvedValue(true);
        await dropFileOnSelectButton(PDF_PATH);
        const printBtn = await screen.findByName("print-button", { as: Gtk.Button });

        await waitFor(() => {
            expect(printBtn).toBeEnabled();
        });

        try {
            await userEvent.click(printBtn);

            await waitFor(() => {
                expect(printFileSpy).toHaveBeenCalled();
            });
        } finally {
            printFileSpy.mockRestore();
        }
    });
});
