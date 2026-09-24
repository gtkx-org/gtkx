import * as Gdk from "@gtkx/gi/gdk";
import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { act, screen, userEvent, waitFor } from "@gtkx/testing";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { clipboardDemo } from "../../../src/demos/gestures/clipboard.js";
import {
    findButton,
    makeDialogDismissedError,
    makeFileValue,
    makeIntValue,
    makeRgba,
    makeRgbaValue,
    makeStringValue,
    renderDemo,
} from "../../test-utils.js";

type SourceType = "Text" | "Color" | "Image" | "File" | "Folder";
type TextureSnapshot = { width: number; height: number; stride: number; digest: string };

const TEMP_DIR = tmpdir();
const switchSourceType = async (type: SourceType): Promise<void> => {
    const dropdown = await screen.findByName("source-type", { as: Gtk.DropDown });
    const items = ["Text", "Color", "Image", "File", "Folder"];
    await userEvent.selectOptions(dropdown, items.indexOf(type));
};

const renderSourceType = async (type: SourceType): Promise<void> => {
    await renderDemo(clipboardDemo);
    await switchSourceType(type);
};

const getDefaultClipboard = (): Gdk.Clipboard => {
    const clipboard = Gdk.Display.getDefault()?.getClipboard();
    expect(clipboard).toBeInstanceOf(Gdk.Clipboard);

    return clipboard as Gdk.Clipboard;
};

const populateClipboardString = async (text: string): Promise<void> => {
    const clipboard = getDefaultClipboard();
    const value = new GObject.Value();
    value.init(GObject.TYPE_STRING);
    value.setString(text);

    await act(() => {
        clipboard.set(value);
    });
};

const populateClipboardRgba = async (): Promise<void> => {
    const clipboard = getDefaultClipboard();
    const rgba = new Gdk.RGBA();
    rgba.red = 0.25;
    rgba.green = 0.5;
    rgba.blue = 0.75;
    rgba.alpha = 1;
    const value = new GObject.Value();
    value.init(GObject.typeFromName("GdkRGBA"));
    value.setBoxed(rgba);

    await act(() => {
        clipboard.set(value);
    });
};

const populateClipboardFile = async (): Promise<void> => {
    const clipboard = getDefaultClipboard();
    const file = Gio.File.newForPath("/tmp");
    const value = new GObject.Value();
    value.init(GObject.typeFromName("GFile"));
    value.setObject(file);

    await act(() => {
        clipboard.set(value);
    });
};

const copyImageSource = async (): Promise<void> => {
    await renderSourceType("Image");
    const copyButton = await findButton("Copy");
    await userEvent.click(copyButton);
};

const getPasteStack = async (): Promise<Gtk.Stack> => await screen.findByName("paste-stack", { as: Gtk.Stack });

const expectClipboardHolds = async (gtype: ReturnType<typeof GObject.typeFromName>): Promise<void> => {
    await waitFor(() => {
        expect(getDefaultClipboard().getFormats().containGtype(gtype)).toBe(true);
    });
};

const readClipboardPng = async (): Promise<Gdk.Texture> => {
    const clipboard = getDefaultClipboard();

    await waitFor(() => {
        expect(clipboard.getFormats().containMimeType("image/png")).toBe(true);
    });

    const [input, mimeType] = await clipboard.readAsync(["image/png"], GLib.PRIORITY_DEFAULT, null);
    expect(mimeType).toBe("image/png");

    if (input === null) {
        throw new TypeError("Clipboard returned no PNG stream");
    }

    const output = Gio.MemoryOutputStream.newResizable();
    await output.spliceAsync(
        input,
        Gio.OutputStreamSpliceFlags.CLOSE_SOURCE | Gio.OutputStreamSpliceFlags.CLOSE_TARGET,
        GLib.PRIORITY_DEFAULT,
        null,
    );

    return Gdk.Texture.newFromBytes(output.stealAsBytes());
};

const textureSnapshot = (texture: Gdk.Texture): TextureSnapshot => {
    const downloader = Gdk.TextureDownloader.new(texture);
    downloader.setFormat(Gdk.MemoryFormat.R8G8B8A8);
    const [bytes, stride] = downloader.downloadBytes();
    const pixels = bytes.getData();

    if (pixels === null) {
        throw new TypeError("GDK returned no texture pixels");
    }

    return {
        width: texture.getWidth(),
        height: texture.getHeight(),
        stride,
        digest: createHash("sha256").update(pixels).digest("hex"),
    };
};

const textureFromImage = (image: Gtk.Image): Gdk.Texture => {
    const paintable = image.getPaintable();

    if (!(paintable instanceof Gdk.Texture)) {
        throw new TypeError("Image does not contain a texture");
    }

    return paintable;
};

const textureFromToggle = (toggle: Gtk.ToggleButton): Gdk.Texture => {
    const image = toggle.getChild();

    if (!(image instanceof Gtk.Image)) {
        throw new TypeError("Image toggle does not contain an image");
    }

    return textureFromImage(image);
};

const findPastedTexture = async (): Promise<Gdk.Texture> => {
    const stack = await getPasteStack();

    await waitFor(() => {
        expect(stack).toHaveObjectProperty("visibleChildName", "Image");
    });

    const child = stack.getVisibleChild();

    if (!(child instanceof Gtk.Image)) {
        throw new TypeError("Pasted image page does not contain an image");
    }

    return textureFromImage(child);
};

const dropOnPasteBox = async (value: GObject.Value): Promise<Gtk.Label> => {
    const pasteBox = await screen.findByName("paste-box", { as: Gtk.Box });
    await userEvent.drop(pasteBox, value);

    return await screen.findByName("paste-type-label", { as: Gtk.Label });
};

const expectPasteTypeLabel = async (label: Gtk.Label, type: string): Promise<void> => {
    await waitFor(() => {
        expect(label).toHaveTextContent(type);
    });
};

const makePaintableValue = (): GObject.Value => {
    const paintable = Gtk.WidgetPaintable.new(new Gtk.Label());
    const value = new GObject.Value();
    value.init(GObject.typeFromName("GdkPaintable"));
    value.setObject(paintable);

    return value;
};

const pasteAndAssertType = async (assertType: (label: Gtk.Label) => void): Promise<void> => {
    const pasteButton = await findButton("Paste");

    await waitFor(() => {
        expect(pasteButton).toBeEnabled();
    });

    await userEvent.click(pasteButton);
    const label = await screen.findByName("paste-type-label", { as: Gtk.Label });

    await waitFor(() => {
        assertType(label);
    });
};

const runWithFileDialog = async <T,>(
    method: "open" | "selectFolder",
    result: Gio.File | Error,
    body: () => Promise<T>,
): Promise<T> => {
    const dialogSpy = vi.spyOn(Gtk.FileDialog.prototype, method);

    if (result instanceof Error) {
        dialogSpy.mockRejectedValue(result);
    } else {
        dialogSpy.mockResolvedValue(result);
    }

    try {
        return await body();
    } finally {
        dialogSpy.mockRestore();
    }
};

const clickSourceButtonAfterDialog = async (
    kind: "File" | "Folder",
    label: "File Drag Source" | "Folder Drag Source",
): Promise<void> => {
    await renderSourceType(kind);
    await clickSourceButton(label);
};

const clickSourceButton = async (label: "File Drag Source" | "Folder Drag Source"): Promise<void> => {
    const sourceButton = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: label, as: Gtk.Button });

    await act(async () => {
        await userEvent.click(sourceButton);
        await Promise.resolve();
    });
};

const expectCopyEnabledAfterDialog = async (
    kind: "File" | "Folder",
    label: "File Drag Source" | "Folder Drag Source",
): Promise<Gtk.Button> => {
    await clickSourceButtonAfterDialog(kind, label);
    const copyButton = await findButton("Copy");

    await waitFor(() => {
        expect(copyButton).toBeEnabled();
    });

    return copyButton;
};

describe("clipboardDemo rendering", () => {
    it(
        "renders the intro label, the text source entry initialised to 'Copy this!' and the Copy/Paste buttons",
        async () => {
            await renderDemo(clipboardDemo);

            expect(await screen.findByText(/^“Copy” will copy/)).toHaveTextContent(
                "“Copy” will copy the selected data to the clipboard",
            );

            expect(await screen.findByDisplayValue("Copy this!")).toHaveDisplayValue("Copy this!");
            const copyButton = await findButton("Copy");
            expect(copyButton).toBeEnabled();
            await findButton("Paste");
        },
    );

    it("renders three image toggle buttons with the rose toggle active by default", async () => {
        await renderSourceType("Image");
        const rose = await screen.findByName("image_rose", { as: Gtk.ToggleButton });
        const floppy = await screen.findByName("image_floppy", { as: Gtk.ToggleButton });
        const logo = await screen.findByName("image_logo", { as: Gtk.ToggleButton });
        expect(rose).toBePressed();
        expect(floppy).not.toBePressed();
        expect(logo).not.toBePressed();
    });

    it("labels the Color source page button and initialises it to the purple source color", async () => {
        await renderSourceType("Color");
        const colorButton = await screen.findByName("color-button", { as: Gtk.ColorDialogButton });
        expect(colorButton).toHaveAccessibleName("Color Drag Source");
        const rgba = colorButton.getRgba();
        expect(rgba.red).toBeCloseTo(128 / 255, 2);
        expect(rgba.green).toBe(0);
        expect(rgba.blue).toBeCloseTo(128 / 255, 2);
        expect(rgba.alpha).toBe(1);
    });

    it("renders the source GtkStack initialised to the 'Text' page", async () => {
        await renderDemo(clipboardDemo);
        const sourceStack = await screen.findByName("source-stack", { as: Gtk.Stack });
        expect(sourceStack).toHaveObjectProperty("visibleChildName", "Text");
    });
});

describe("clipboardDemo entry interactions", () => {
    it("updates the entry text when the user types", async () => {
        await renderDemo(clipboardDemo);
        const entry = await screen.findByName("source-entry", { as: Gtk.Entry });
        await userEvent.clear(entry);
        await userEvent.type(entry, "hello clipboard");
        expect(entry).toHaveDisplayValue("hello clipboard");
    });

    it("disables the copy button when the text source is cleared", async () => {
        await renderDemo(clipboardDemo);
        const entry = await screen.findByName("source-entry", { as: Gtk.Entry });
        const copyButton = await findButton("Copy");
        expect(copyButton).toBeEnabled();
        await userEvent.clear(entry);

        await waitFor(() => {
            expect(copyButton).toBeDisabled();
        });
    });

    it("re-enables the copy button when the user types text after clearing the source", async () => {
        await renderDemo(clipboardDemo);
        const entry = await screen.findByName("source-entry", { as: Gtk.Entry });
        const copyButton = await findButton("Copy");
        await userEvent.clear(entry);

        await waitFor(() => {
            expect(copyButton).toBeDisabled();
        });

        await userEvent.type(entry, "retyped");

        await waitFor(() => {
            expect(copyButton).toBeEnabled();
        });
    });
});

describe("clipboardDemo source type switching", () => {
    it("switches the source stack to the Color page when Color is selected", async () => {
        await renderSourceType("Color");
        const stack = await screen.findByName("source-stack", { as: Gtk.Stack });

        await waitFor(() => {
            expect(stack).toHaveObjectProperty("visibleChildName", "Color");
        });
    });

    it("switches the source stack to the Image page when Image is selected", async () => {
        await renderSourceType("Image");
        const stack = await screen.findByName("source-stack", { as: Gtk.Stack });

        await waitFor(() => {
            expect(stack).toHaveObjectProperty("visibleChildName", "Image");
        });
    });

    it(
        "switches the source stack to the File page when File is selected and disables Copy until a file is chosen",
        async () => {
            await renderSourceType("File");
            const stack = await screen.findByName("source-stack", { as: Gtk.Stack });

            await waitFor(() => {
                expect(stack).toHaveObjectProperty("visibleChildName", "File");
            });

            const copyButton = await findButton("Copy");

            await waitFor(() => {
                expect(copyButton).toBeDisabled();
            });
        },
    );

    it(
        "switches the source stack to the Folder page when Folder is selected " +
        "and disables Copy until a folder is chosen",
        async () => {
            await renderSourceType("Folder");
            const stack = await screen.findByName("source-stack", { as: Gtk.Stack });

            await waitFor(() => {
                expect(stack).toHaveObjectProperty("visibleChildName", "Folder");
            });

            const copyButton = await findButton("Copy");

            await waitFor(() => {
                expect(copyButton).toBeDisabled();
            });
        },
    );
});

describe("clipboardDemo image source", () => {
    it("activates the floppy buddy image toggle when clicked and deselects the default rose toggle", async () => {
        await renderSourceType("Image");
        const rose = await screen.findByName("image_rose", { as: Gtk.ToggleButton });
        const floppy = await screen.findByName("image_floppy", { as: Gtk.ToggleButton });
        expect(rose).toBePressed();
        await userEvent.click(floppy);

        await waitFor(() => {
            expect(floppy).toBePressed();
            expect(rose).not.toBePressed();
        });
    });

    it("activates the logo image toggle when clicked", async () => {
        await renderSourceType("Image");
        const logo = await screen.findByName("image_logo", { as: Gtk.ToggleButton });
        await userEvent.click(logo);

        await waitFor(() => {
            expect(logo).toBePressed();
        });
    });

    it("keeps the selected image active when it is clicked again", async () => {
        await renderSourceType("Image");
        const rose = await screen.findByName("image_rose", { as: Gtk.ToggleButton });
        await userEvent.click(rose);

        await waitFor(() => {
            expect(rose).toBePressed();
        });
    });
});

describe("clipboardDemo color source", () => {
    it("copies the color chosen through the color button after onNotifyRgba updates the source color", async () => {
        await renderSourceType("Color");
        const colorButton = await screen.findByName("color-button", { as: Gtk.ColorDialogButton });
        const chosen = makeRgba(0.2, 0.4, 0.6, 1);

        await act(() => {
            colorButton.setRgba(chosen);
        });

        const copyButton = await findButton("Copy");
        await userEvent.click(copyButton);
        const rgbaType = GObject.typeFromName("GdkRGBA");
        await expectClipboardHolds(rgbaType);
        const rgba = (await getDefaultClipboard().readValueAsync(rgbaType, 0, null)) as Gdk.RGBA;
        expect(rgba.red).toBeCloseTo(0.2, 2);
        expect(rgba.green).toBeCloseTo(0.4, 2);
        expect(rgba.blue).toBeCloseTo(0.6, 2);
    });
});

describe("clipboardDemo Copy button populates the clipboard", () => {
    it("copies a string when Copy is clicked with text selected", async () => {
        await renderDemo(clipboardDemo);
        const copyButton = await findButton("Copy");
        await userEvent.click(copyButton);
        await expectClipboardHolds(GObject.TYPE_STRING);
    });

    it("copies an RGBA color when Copy is clicked with Color source selected", async () => {
        await renderSourceType("Color");
        const copyButton = await findButton("Copy");
        await userEvent.click(copyButton);
        await expectClipboardHolds(GObject.typeFromName("GdkRGBA"));
    });

    it("offers a decodable PNG when Copy is clicked with Image source selected", async () => {
        await copyImageSource();
        const texture = await readClipboardPng();
        expect(texture.getWidth()).toBeGreaterThan(0);
        expect(texture.getHeight()).toBeGreaterThan(0);
    });
});

describe("clipboardDemo Paste button updates pasted content", () => {
    it("shows pasted Text when the clipboard holds a string", async () => {
        await renderDemo(clipboardDemo);
        await populateClipboardString("clipboard string");

        await pasteAndAssertType((label) => {
            expect(label).toHaveTextContent("Text");
        });
    });

    it("shows pasted Color when the clipboard holds an RGBA value", async () => {
        await renderDemo(clipboardDemo);
        await populateClipboardRgba();

        await pasteAndAssertType((label) => {
            expect(label).toHaveTextContent("Color");
        });
    });

    it("shows the pasted File type and renders the resolved path when the clipboard holds a GFile", async () => {
        await renderDemo(clipboardDemo);
        await populateClipboardFile();

        await pasteAndAssertType((label) => {
            expect(label).toHaveTextContent("File");
        });

        const pasteStack = await getPasteStack();

        await waitFor(() => {
            expect(pasteStack).toHaveObjectProperty("visibleChildName", "File");
            expect(pasteStack.getVisibleChild()).toHaveTextContent("/tmp");
        });
    });

    it("renders the pasted string on the paste-stack Text page when a string is pasted", async () => {
        await renderDemo(clipboardDemo);
        await populateClipboardString("hello pasted world");

        await pasteAndAssertType((label) => {
            expect(label).toHaveTextContent("Text");
        });

        const pasteStack = await getPasteStack();

        await waitFor(() => {
            expect(pasteStack).toHaveObjectProperty("visibleChildName", "Text");
            expect(pasteStack.getVisibleChild()).toHaveTextContent("hello pasted world");
        });
    });
});

describe("clipboardDemo paste-box drop handler", () => {
    it("updates the pasted content label to 'Text' when a string is dropped", async () => {
        await renderDemo(clipboardDemo);
        const label = await dropOnPasteBox(makeStringValue("dropped text"));
        await expectPasteTypeLabel(label, "Text");
    });

    it("accepts an empty string dropped on the paste target", async () => {
        await renderDemo(clipboardDemo);
        const label = await dropOnPasteBox(makeStringValue(""));
        await expectPasteTypeLabel(label, "Text");
    });

    it("updates the pasted content label to 'Color' when an RGBA is dropped", async () => {
        await renderDemo(clipboardDemo);
        const label = await dropOnPasteBox(makeRgbaValue(0.5, 0.2, 0.8, 1));
        await expectPasteTypeLabel(label, "Color");
    });

    it("updates the pasted content label to 'File' when a GFile is dropped", async () => {
        await renderDemo(clipboardDemo);
        const label = await dropOnPasteBox(makeFileValue("/tmp"));
        await expectPasteTypeLabel(label, "File");
    });
});

describe("clipboardDemo drag sources", () => {
    it("drags the text entry's content to the paste target", async () => {
        await renderDemo(clipboardDemo);
        const entry = await screen.findByName("source-entry", { as: Gtk.Entry });
        const pasteBox = await screen.findByName("paste-box", { as: Gtk.Box });
        await userEvent.dragAndDrop(entry, pasteBox);
        const label = await screen.findByName("paste-type-label", { as: Gtk.Label });
        await expectPasteTypeLabel(label, "Text");
    });

    it("drags the color button's content to the paste target", async () => {
        await renderSourceType("Color");
        const colorButton = await screen.findByName("color-button", { as: Gtk.ColorDialogButton });
        const pasteBox = await screen.findByName("paste-box", { as: Gtk.Box });
        await userEvent.dragAndDrop(colorButton, pasteBox);
        const label = await screen.findByName("paste-type-label", { as: Gtk.Label });
        await expectPasteTypeLabel(label, "Color");
    });

    it("drags the default rose texture to the paste target", async () => {
        await renderSourceType("Image");
        const roseToggle = await screen.findByName("image_rose", { as: Gtk.ToggleButton });
        const pasteBox = await screen.findByName("paste-box", { as: Gtk.Box });
        const source = textureSnapshot(textureFromToggle(roseToggle));
        await userEvent.dragAndDrop(roseToggle, pasteBox);
        expect(textureSnapshot(await findPastedTexture())).toEqual(source);
    });

    it("drags an unselected image's own texture to the paste target", async () => {
        await renderSourceType("Image");
        const roseToggle = await screen.findByName("image_rose", { as: Gtk.ToggleButton });
        const floppyToggle = await screen.findByName("image_floppy", { as: Gtk.ToggleButton });
        const pasteBox = await screen.findByName("paste-box", { as: Gtk.Box });
        const rose = textureSnapshot(textureFromToggle(roseToggle));
        const floppy = textureSnapshot(textureFromToggle(floppyToggle));
        expect(floppyToggle).not.toBePressed();
        expect(floppy).not.toEqual(rose);
        await userEvent.dragAndDrop(floppyToggle, pasteBox);
        expect(textureSnapshot(await findPastedTexture())).toEqual(floppy);
    });
});

describe("clipboardDemo paste content rendering", () => {
    it("switches the paste stack to the Color swatch page after a Color is dropped on the paste box", async () => {
        await renderDemo(clipboardDemo);
        const label = await dropOnPasteBox(makeRgbaValue(0.9, 0.1, 0.5, 1));
        await expectPasteTypeLabel(label, "Color");
        const pasteStack = await getPasteStack();

        await waitFor(() => {
            expect(pasteStack).toHaveObjectProperty("visibleChildName", "Color");
        });

        expect(pasteStack.getVisibleChild()).toBeInstanceOf(Gtk.DrawingArea);
    });

    it(
        "renders the pasted image on the paste-stack Image page when a paintable is dropped on the paste box",
        async () => {
            await renderDemo(clipboardDemo);
            const label = await dropOnPasteBox(makePaintableValue());
            await expectPasteTypeLabel(label, "Image");
            const pasteStack = await getPasteStack();

            await waitFor(() => {
                expect(pasteStack).toHaveObjectProperty("visibleChildName", "Image");
                expect(pasteStack.getVisibleChild()).toBeInstanceOf(Gtk.Image);
            });
        },
    );
});

describe("clipboardDemo paste after copy round-trip", () => {
    it("shows pasted Image when the clipboard holds a texture copied from the demo", async () => {
        await copyImageSource();

        await pasteAndAssertType((label) => {
            expect(label).toHaveTextContent("Image");
        });
    });
});

describe("clipboardDemo file source selection", () => {
    it("opens a Gtk.FileDialog and updates the source file when the File button is clicked", async () => {
        await runWithFileDialog("open", Gio.File.newForPath(join(TEMP_DIR, "fake-file.txt")), async () => {
            await expectCopyEnabledAfterDialog("File", "File Drag Source");
        });
    });

    it("opens a Gtk.FileDialog folder picker when the Folder button is clicked", async () => {
        await runWithFileDialog("selectFolder", Gio.File.newForPath("/tmp"), async () => {
            await expectCopyEnabledAfterDialog("Folder", "Folder Drag Source");
        });
    });

    it("shows the URI returned for a non-local file", async () => {
        const uri = "sftp://example.test/home/demo.txt";

        await runWithFileDialog("open", Gio.File.newForUri(uri), async () => {
            await clickSourceButtonAfterDialog("File", "File Drag Source");
            const sourceButton = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "File Drag Source" });
            expect(sourceButton).toHaveTextContent(uri);
        });
    });

    it("keeps the File source empty when the dialog is dismissed", async () => {
        await runWithFileDialog("open", makeDialogDismissedError(), async () => {
            await clickSourceButtonAfterDialog("File", "File Drag Source");
            const sourceButton = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "File Drag Source" });
            expect(sourceButton).toHaveTextContent("—");
            expect(await findButton("Copy")).toBeDisabled();
        });
    });

    it("keeps file and folder selections independent across source changes", async () => {
        const filePath = join(TEMP_DIR, "independent-file.txt");
        const folderPath = join(TEMP_DIR, "independent-folder");
        await renderDemo(clipboardDemo);
        await switchSourceType("File");

        await runWithFileDialog("open", Gio.File.newForPath(filePath), async () => {
            await clickSourceButton("File Drag Source");
        });

        const fileButton = await screen.findByRole(Gtk.AccessibleRole.BUTTON, {
            name: "File Drag Source",
            as: Gtk.Button,
        });
        const copyButton = await findButton("Copy");

        await waitFor(() => {
            expect(fileButton).toHaveTextContent(filePath);
            expect(copyButton).toBeEnabled();
        });

        await switchSourceType("Folder");
        const folderButton = await screen.findByRole(Gtk.AccessibleRole.BUTTON, {
            name: "Folder Drag Source",
            as: Gtk.Button,
        });

        await waitFor(() => {
            expect(folderButton).toHaveTextContent("—");
            expect(copyButton).toBeDisabled();
        });

        await runWithFileDialog("selectFolder", Gio.File.newForPath(folderPath), async () => {
            await clickSourceButton("Folder Drag Source");
        });

        await waitFor(() => {
            expect(folderButton).toHaveTextContent(folderPath);
            expect(copyButton).toBeEnabled();
        });

        await switchSourceType("File");

        await waitFor(() => {
            expect(fileButton).toHaveTextContent(filePath);
            expect(copyButton).toBeEnabled();
        });

        await switchSourceType("Folder");

        await waitFor(() => {
            expect(folderButton).toHaveTextContent(folderPath);
            expect(copyButton).toBeEnabled();
        });
    });
});

describe("clipboardDemo file source copying", () => {
    it("copies a file to the clipboard after the file dialog selects a file", async () => {
        await runWithFileDialog("open", Gio.File.newForPath(join(TEMP_DIR, "some-file.txt")), async () => {
            const copyButton = await expectCopyEnabledAfterDialog("File", "File Drag Source");
            await userEvent.click(copyButton);
            await expectClipboardHolds(GObject.typeFromName("GFile"));
        });
    });

    it("copies a folder GFile to the clipboard after the folder dialog selects a folder", async () => {
        await runWithFileDialog("selectFolder", Gio.File.newForPath("/tmp"), async () => {
            const copyButton = await expectCopyEnabledAfterDialog("Folder", "Folder Drag Source");
            await userEvent.click(copyButton);
            await expectClipboardHolds(GObject.typeFromName("GFile"));
        });
    });
});

describe("clipboardDemo paste-box drop with object types", () => {
    it("updates the pasted content label to 'File' when a GFile object is dropped via the OBJECT branch", async () => {
        await renderDemo(clipboardDemo);
        const label = await dropOnPasteBox(makeFileValue("/etc"));
        await expectPasteTypeLabel(label, "File");
    });

    it("returns false from the drop handler when the dropped value is unrecognized", async () => {
        await renderDemo(clipboardDemo);
        const label = await dropOnPasteBox(makeIntValue(42));
        expect(label).not.toHaveTextContent();
    });
});
