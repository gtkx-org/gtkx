import * as Gtk from "@gtkx/ffi/gtk";
import { ApplicationWindow, Box, Button, Frame, Label, quit, render, ScrolledWindow, Separator } from "@gtkx/gtkx";
import { useState } from "react";

const FileDialogSection = () => {
    const [result, setResult] = useState<string>("No file selected");

    const handleOpen = async () => {
        const dialog = new Gtk.FileDialog();
        dialog.setTitle("Open File");
        try {
            const file = await dialog.open();
            const path = file.getPath();
            setResult(`File selected:\n${path}`);
        } catch {
            setResult("Dialog cancelled");
        }
    };

    const handleOpenMultiple = async () => {
        const dialog = new Gtk.FileDialog();
        dialog.setTitle("Open Multiple Files");
        try {
            const files = await dialog.openMultiple();
            setResult(`Multiple files selected!\nHas pointer: ${files.ptr !== undefined}`);
        } catch {
            setResult("Dialog cancelled");
        }
    };

    const handleSave = async () => {
        const dialog = new Gtk.FileDialog();
        dialog.setTitle("Save File");
        dialog.setInitialName("untitled.txt");
        try {
            const file = await dialog.save();
            setResult(`Save location selected!\nHas pointer: ${file.ptr !== undefined}`);
        } catch {
            setResult("Dialog cancelled");
        }
    };

    const handleSelectFolder = async () => {
        const dialog = new Gtk.FileDialog();
        dialog.setTitle("Select Folder");
        try {
            const folder = await dialog.selectFolder();
            setResult(`Folder selected!\nHas pointer: ${folder.ptr !== undefined}`);
        } catch {
            setResult("Dialog cancelled");
        }
    };

    const handleSelectMultipleFolders = async () => {
        const dialog = new Gtk.FileDialog();
        dialog.setTitle("Select Multiple Folders");
        try {
            const folders = await dialog.selectMultipleFolders();
            setResult(`Multiple folders selected!\nHas pointer: ${folders.ptr !== undefined}`);
        } catch {
            setResult("Dialog cancelled");
        }
    };

    return (
        <Frame.Root label="File Dialogs">
            <Frame.Child>
                <Box
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={8}
                    marginTop={8}
                    marginBottom={8}
                    marginStart={8}
                    marginEnd={8}
                >
                    <Label.Root label="Native GTK4 file chooser dialogs with Promise-based API" xalign={0} />
                    <Box spacing={8}>
                        <Button label="Open File" onClicked={handleOpen} />
                        <Button label="Open Multiple" onClicked={handleOpenMultiple} />
                        <Button label="Save File" onClicked={handleSave} />
                        <Button label="Select Folder" onClicked={handleSelectFolder} />
                        <Button label="Select Folders" onClicked={handleSelectMultipleFolders} />
                    </Box>
                    <Label.Root label={result} xalign={0} wrap selectable />
                </Box>
            </Frame.Child>
        </Frame.Root>
    );
};

const ColorDialogSection = () => {
    const [result, setResult] = useState<string>("No color selected");

    const handleChooseColor = async () => {
        const dialog = new Gtk.ColorDialog();
        dialog.setTitle("Choose Color");
        dialog.setWithAlpha(true);
        try {
            const rgba = await dialog.chooseRgba();
            const r = Math.round(rgba.red * 255);
            const g = Math.round(rgba.green * 255);
            const b = Math.round(rgba.blue * 255);
            const a = rgba.alpha;
            setResult(`RGBA: (${r}, ${g}, ${b}, ${a.toFixed(2)})`);
        } catch {
            setResult("Dialog cancelled");
        }
    };

    return (
        <Frame.Root label="Color Dialog">
            <Frame.Child>
                <Box
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={8}
                    marginTop={8}
                    marginBottom={8}
                    marginStart={8}
                    marginEnd={8}
                >
                    <Label.Root label="Native color picker with alpha channel support" xalign={0} />
                    <Box spacing={8}>
                        <Button label="Choose Color" onClicked={handleChooseColor} cssClasses={["suggested-action"]} />
                    </Box>
                    <Label.Root label={result} xalign={0} />
                </Box>
            </Frame.Child>
        </Frame.Root>
    );
};

const FontDialogSection = () => {
    const [result, setResult] = useState<string>("No font selected");

    const handleChooseFont = async () => {
        const dialog = new Gtk.FontDialog();
        dialog.setTitle("Choose Font");
        try {
            const fontDesc = await dialog.chooseFont();
            const family = fontDesc.getFamily() ?? "Unknown";
            const size = fontDesc.getSize() / 1024;
            setResult(`Font: ${family}, ${size}pt`);
        } catch {
            setResult("Dialog cancelled");
        }
    };

    const handleChooseFontFamily = async () => {
        const dialog = new Gtk.FontDialog();
        dialog.setTitle("Choose Font Family");
        try {
            const family = await dialog.chooseFamily();
            const name = family.getName();
            setResult(`Family: ${name}`);
        } catch {
            setResult("Dialog cancelled");
        }
    };

    return (
        <Frame.Root label="Font Dialog">
            <Frame.Child>
                <Box
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={8}
                    marginTop={8}
                    marginBottom={8}
                    marginStart={8}
                    marginEnd={8}
                >
                    <Label.Root label="System font picker with family and style selection" xalign={0} />
                    <Box spacing={8}>
                        <Button label="Choose Font" onClicked={handleChooseFont} />
                        <Button label="Choose Family" onClicked={handleChooseFontFamily} />
                    </Box>
                    <Label.Root label={result} xalign={0} />
                </Box>
            </Frame.Child>
        </Frame.Root>
    );
};

const AlertDialogSection = () => {
    const [result, setResult] = useState<string>("No choice made");

    const handleAlert = async () => {
        const dialog = new Gtk.AlertDialog();
        dialog.setMessage("Confirm Action");
        dialog.setDetail("Are you sure you want to proceed with this action? This cannot be undone.");
        dialog.setButtons(["Cancel", "Delete"]);
        dialog.setCancelButton(0);
        dialog.setDefaultButton(1);
        try {
            const choice = await dialog.choose();
            const buttons = ["Cancel", "Delete"];
            setResult(`You clicked: ${buttons[choice] ?? `Button ${choice}`}`);
        } catch {
            setResult("Dialog dismissed");
        }
    };

    const handleCustomAlert = async () => {
        const dialog = new Gtk.AlertDialog();
        dialog.setMessage("Save Changes?");
        dialog.setDetail("You have unsaved changes. What would you like to do?");
        dialog.setButtons(["Don't Save", "Cancel", "Save"]);
        dialog.setCancelButton(1);
        dialog.setDefaultButton(2);
        try {
            const choice = await dialog.choose();
            const buttons = ["Don't Save", "Cancel", "Save"];
            setResult(`You clicked: ${buttons[choice] ?? `Button ${choice}`}`);
        } catch {
            setResult("Dialog dismissed");
        }
    };

    return (
        <Frame.Root label="Alert Dialog">
            <Frame.Child>
                <Box
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={8}
                    marginTop={8}
                    marginBottom={8}
                    marginStart={8}
                    marginEnd={8}
                >
                    <Label.Root label="Modal alert dialogs with customizable buttons" xalign={0} />
                    <Box spacing={8}>
                        <Button label="Confirm Delete" onClicked={handleAlert} cssClasses={["destructive-action"]} />
                        <Button label="Save Changes?" onClicked={handleCustomAlert} />
                    </Box>
                    <Label.Root label={result} xalign={0} />
                </Box>
            </Frame.Child>
        </Frame.Root>
    );
};

const App = () => {
    return (
        <ApplicationWindow title="GTK4 Dialog Showcase" defaultWidth={600} defaultHeight={700} onCloseRequest={quit}>
            <ScrolledWindow vexpand hexpand>
                <Box
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={16}
                    marginTop={16}
                    marginBottom={16}
                    marginStart={16}
                    marginEnd={16}
                >
                    <Label.Root label="GTK4 Native Dialogs" />
                    <Label.Root label="All dialogs use the Promise-based API for clean async/await syntax" />
                    <Separator orientation={Gtk.Orientation.HORIZONTAL} />
                    <FileDialogSection />
                    <ColorDialogSection />
                    <FontDialogSection />
                    <AlertDialogSection />
                </Box>
            </ScrolledWindow>
        </ApplicationWindow>
    );
};

render(<App />, "com.gtkx.file-dialogs");
