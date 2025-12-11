import { AccessibleRole } from "@gtkx/ffi/gtk";
import { cleanup, render, screen } from "@gtkx/testing";
import { afterEach, describe, expect, it } from "vitest";
import { aboutDialogDemo } from "../src/demos/dialogs/about-dialog.js";
import { colorChooserDemo } from "../src/demos/dialogs/color-chooser.js";
import { dialogDemo } from "../src/demos/dialogs/dialog.js";
import { fileChooserDemo } from "../src/demos/dialogs/file-chooser.js";

describe("Dialogs Demos", () => {
    afterEach(async () => {
        await cleanup();
    });

    describe("about dialog demo", () => {
        const AboutDialogDemo = aboutDialogDemo.component;

        it("renders about dialog title", async () => {
            await render(<AboutDialogDemo />);

            const title = await screen.findByText("About Dialog");
            expect(title).toBeDefined();
        });

        it("renders description about AboutDialog", async () => {
            await render(<AboutDialogDemo />);

            const description = await screen.findByText(
                "AboutDialog displays information about your application including version, copyright, license, and credits.",
            );
            expect(description).toBeDefined();
        });

        it("renders show about dialog button", async () => {
            await render(<AboutDialogDemo />);

            const button = await screen.findByRole(AccessibleRole.BUTTON, { name: "Show About Dialog" });
            expect(button).toBeDefined();
        });

        it("renders features section", async () => {
            await render(<AboutDialogDemo />);

            const heading = await screen.findByText("Features");
            expect(heading).toBeDefined();
        });

        it("renders features list", async () => {
            await render(<AboutDialogDemo />);

            const featuresList = await screen.findByText(/Program name and version/);
            expect(featuresList).toBeDefined();
        });
    });

    describe("dialog demo", () => {
        const DialogDemo = dialogDemo.component;

        it("renders dialogs title", async () => {
            await render(<DialogDemo />);

            const title = await screen.findByText("Dialogs");
            expect(title).toBeDefined();
        });

        it("renders alert dialogs section", async () => {
            await render(<DialogDemo />);

            const heading = await screen.findByText("Alert Dialogs");
            const description = await screen.findByText(
                "AlertDialog provides a simple way to show messages and get user confirmation.",
            );

            expect(heading).toBeDefined();
            expect(description).toBeDefined();
        });

        it("renders confirmation button", async () => {
            await render(<DialogDemo />);

            const button = await screen.findByRole(AccessibleRole.BUTTON, { name: "Confirmation" });
            expect(button).toBeDefined();
        });

        it("renders destructive button", async () => {
            await render(<DialogDemo />);

            const button = await screen.findByRole(AccessibleRole.BUTTON, { name: "Destructive" });
            expect(button).toBeDefined();
        });

        it("renders information button", async () => {
            await render(<DialogDemo />);

            const button = await screen.findByRole(AccessibleRole.BUTTON, { name: "Information" });
            expect(button).toBeDefined();
        });

        it("renders how it works section", async () => {
            await render(<DialogDemo />);

            const heading = await screen.findByText("How It Works");
            const description = await screen.findByText(/Use AlertDialog.dialogNew\(message\) to create the dialog/);

            expect(heading).toBeDefined();
            expect(description).toBeDefined();
        });
    });

    describe("file chooser demo", () => {
        const FileChooserDemo = fileChooserDemo.component;

        it("renders file chooser title", async () => {
            await render(<FileChooserDemo />);

            const title = await screen.findByText("File Chooser");
            expect(title).toBeDefined();
        });

        it("renders open file section", async () => {
            await render(<FileChooserDemo />);

            const heading = await screen.findByText("Open File");
            const button = await screen.findByRole(AccessibleRole.BUTTON, { name: "Open File..." });

            expect(heading).toBeDefined();
            expect(button).toBeDefined();
        });

        it("renders select folder section", async () => {
            await render(<FileChooserDemo />);

            const heading = await screen.findByText("Select Folder");
            const button = await screen.findByRole(AccessibleRole.BUTTON, { name: "Select Folder..." });

            expect(heading).toBeDefined();
            expect(button).toBeDefined();
        });

        it("renders save file section", async () => {
            await render(<FileChooserDemo />);

            const heading = await screen.findByText("Save File");
            const button = await screen.findByRole(AccessibleRole.BUTTON, { name: "Save As..." });

            expect(heading).toBeDefined();
            expect(button).toBeDefined();
        });

        it("renders about file dialog section", async () => {
            await render(<FileChooserDemo />);

            const heading = await screen.findByText("About FileDialog");
            const description = await screen.findByText(
                "FileDialog is the modern GTK4 file chooser. It uses async/await and returns Gio.File objects that can be used to read or write file contents.",
            );

            expect(heading).toBeDefined();
            expect(description).toBeDefined();
        });
    });

    describe("color chooser demo", () => {
        const ColorChooserDemo = colorChooserDemo.component;

        it("renders color chooser title", async () => {
            await render(<ColorChooserDemo />);

            const title = await screen.findByText("Color Chooser");
            expect(title).toBeDefined();
        });

        it("renders color dialog section", async () => {
            await render(<ColorChooserDemo />);

            const heading = await screen.findByText("Color Dialog");
            const description = await screen.findByText(
                "ColorDialog provides a modern color picker dialog with support for RGBA colors including alpha transparency.",
            );

            expect(heading).toBeDefined();
            expect(description).toBeDefined();
        });

        it("renders choose color button", async () => {
            await render(<ColorChooserDemo />);

            const button = await screen.findByRole(AccessibleRole.BUTTON, { name: "Choose Color..." });
            expect(button).toBeDefined();
        });

        it("renders how it works section", async () => {
            await render(<ColorChooserDemo />);

            const heading = await screen.findByText("How It Works");
            const description = await screen.findByText(
                "ColorDialog uses a Promise-based API. Call dialog.chooseRgba() and await the result. The dialog returns an RGBA struct with red, green, blue, and alpha values.",
            );

            expect(heading).toBeDefined();
            expect(description).toBeDefined();
        });
    });
});
