import * as Gdk from "@gtkx/gi/gdk";
import * as Gio from "@gtkx/gi/gio";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { act, queryController, screen, screenshot, userEvent, waitFor } from "@gtkx/testing";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { clipboardDemo } from "../../../src/demos/gestures/clipboard.js";
import { makeFileValue, makeIntValue, makeRgba, makeRgbaValue, makeStringValue, renderDemo } from "../../test-utils.js";

type SourceType = "Text" | "Color" | "Image" | "File" | "Folder";

const TEMP_DIR = tmpdir();

const findButtonByLabel = async (label: string): Promise<Gtk.Button> =>
    screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: label, as: Gtk.Button });

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
    const copyButton = await findButtonByLabel("Copy");
    await userEvent.click(copyButton);
};

const getPasteStack = async (): Promise<Gtk.Stack> => await screen.findByName("paste-stack", { as: Gtk.Stack });

const expectClipboardHolds = async (gtype: ReturnType<typeof GObject.typeFromName>): Promise<void> => {
    await waitFor(() => {
        expect(getDefaultClipboard().getFormats().containGtype(gtype)).toBe(true);
    });
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
    const pasteButton = await findButtonByLabel("Paste");

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
): Promise<{ value: T; dialogSpy: ReturnType<typeof vi.spyOn> }> => {
    const dialogSpy = vi.spyOn(Gtk.FileDialog.prototype, method);

    if (result instanceof Error) {
        dialogSpy.mockRejectedValue(result);
    } else {
        dialogSpy.mockResolvedValue(result);
    }

    try {
        const value = await body();

        return { value, dialogSpy };
    } finally {
        dialogSpy.mockRestore();
    }
};

const clickSourceButtonAfterDialog = async (
    kind: "File" | "Folder",
    label: "File Drag Source" | "Folder Drag Source",
): Promise<void> => {
    await renderSourceType(kind);
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
    const copyButton = await findButtonByLabel("Copy");

    await waitFor(() => {
        expect(copyButton).toBeEnabled();
    });

    return copyButton;
};

describe("clipboardDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(clipboardDemo.id).toBe("clipboard");
        expect(clipboardDemo.title).toBe("Clipboard");
        expect(clipboardDemo.description.length).toBeGreaterThan(0);
        expect(Array.isArray(clipboardDemo.keywords)).toBe(true);
        expect(typeof clipboardDemo.sourceCode).toBe("string");
        expect(clipboardDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(clipboardDemo.keywords).toContain("drag-and-drop");
        expect(clipboardDemo.component).toBeTypeOf("function");
    });
});

describe("clipboardDemo rendering", () => {
    it(
        "renders the intro label, the text source entry initialised to 'Copy this!' and the Copy/Paste buttons",
        async () => {
            await renderDemo(clipboardDemo);

            expect(await screen.findByText(/^“Copy” will copy/)).toHaveTextContent(
                "“Copy” will copy the selected data the clipboard",
            );

            expect(await screen.findByDisplayValue("Copy this!")).toHaveDisplayValue("Copy this!");
            const copyButton = await findButtonByLabel("Copy");
            expect(copyButton).toBeEnabled();
            await findButtonByLabel("Paste");
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

    it("includes a GtkColorDialogButton for the Color source page", async () => {
        await renderSourceType("Color");
        const colorButton = await screen.findByName("color-button");
        expect(colorButton).toBeInstanceOf(Gtk.ColorDialogButton);
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
        const copyButton = await findButtonByLabel("Copy");
        expect(copyButton).toBeEnabled();
        await userEvent.clear(entry);

        await waitFor(() => {
            expect(copyButton).toBeDisabled();
        });
    });

    it("re-enables the copy button when the user types text after clearing the source", async () => {
        await renderDemo(clipboardDemo);
        const entry = await screen.findByName("source-entry", { as: Gtk.Entry });
        const copyButton = await findButtonByLabel("Copy");
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

            const copyButton = await findButtonByLabel("Copy");

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

            const copyButton = await findButtonByLabel("Copy");

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
});

describe("clipboardDemo color source", () => {
    it("copies the color chosen through the color button after onNotifyRgba updates the source color", async () => {
        await renderSourceType("Color");
        const colorButton = await screen.findByName("color-button", { as: Gtk.ColorDialogButton });
        const chosen = makeRgba(0.2, 0.4, 0.6, 1);

        await act(() => {
            colorButton.setRgba(chosen);
        });

        const copyButton = await findButtonByLabel("Copy");
        await userEvent.click(copyButton);
        const rgbaType = GObject.typeFromName("GdkRGBA");
        await expectClipboardHolds(rgbaType);
        const value = await getDefaultClipboard().readValueAsync(rgbaType, 0, null);
        const rgba = value.getBoxed<Gdk.RGBA>();
        expect(rgba.red).toBeCloseTo(0.2, 2);
        expect(rgba.green).toBeCloseTo(0.4, 2);
        expect(rgba.blue).toBeCloseTo(0.6, 2);
    });
});

describe("clipboardDemo Copy button populates the clipboard", () => {
    it("copies a string when Copy is clicked with text selected", async () => {
        await renderDemo(clipboardDemo);
        const copyButton = await findButtonByLabel("Copy");
        await userEvent.click(copyButton);
        await expectClipboardHolds(GObject.TYPE_STRING);
    });

    it("copies an RGBA color when Copy is clicked with Color source selected", async () => {
        await renderSourceType("Color");
        const copyButton = await findButtonByLabel("Copy");
        await userEvent.click(copyButton);
        await expectClipboardHolds(GObject.typeFromName("GdkRGBA"));
    });

    it("copies a paintable when Copy is clicked with Image source selected", async () => {
        await copyImageSource();
        await expectClipboardHolds(GObject.typeFromName("GdkPaintable"));
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
    it("registers a drag source on the text entry by exposing its drag content via userEvent", async () => {
        await renderDemo(clipboardDemo);
        const entry = await screen.findByName("source-entry", { as: Gtk.Entry });
        const pasteBox = await screen.findByName("paste-box", { as: Gtk.Box });
        await userEvent.dragAndDrop(entry, pasteBox, makeStringValue("Copy this!"));
        const label = await screen.findByName("paste-type-label", { as: Gtk.Label });
        await expectPasteTypeLabel(label, "Text");
    });

    it("registers a drag source on the color button by exposing its color via userEvent", async () => {
        await renderSourceType("Color");
        const colorButton = await screen.findByName("color-button", { as: Gtk.ColorDialogButton });
        const pasteBox = await screen.findByName("paste-box", { as: Gtk.Box });
        await userEvent.dragAndDrop(colorButton, pasteBox, makeRgbaValue(0.5, 0.5, 0.5, 1));
        const label = await screen.findByName("paste-type-label", { as: Gtk.Label });
        await expectPasteTypeLabel(label, "Color");
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
        const window = await screen.findByRole(Gtk.AccessibleRole.WINDOW, { as: Gtk.Window });

        await act(() => {
            window.setVisible(true);
        });

        await screenshot(window);
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

describe("clipboardDemo invalid image path", () => {
    it("logs the texture error when copying an image source whose resource fails to load", async () => {
        await renderSourceType("Image");
        const errorSpy = vi.spyOn(console, "error").mockImplementation((): void => undefined);

        const textureSpy = vi.spyOn(Gdk.Texture, "newFromResource").mockImplementation(() => {
            throw new Error("resource not found");
        });

        try {
            const copyButton = await findButtonByLabel("Copy");
            await userEvent.click(copyButton);

            await waitFor(() => {
                expect(errorSpy).toHaveBeenCalledWith("resource not found");
            });
        } finally {
            textureSpy.mockRestore();
            errorSpy.mockRestore();
        }
    });
});

describe("clipboardDemo paste after copy round-trip", () => {
    it("shows pasted Image when the clipboard holds a paintable copied from the demo", async () => {
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

    it("logs an error when the File dialog rejects", async () => {
        const errorSpy = vi.spyOn(console, "error").mockImplementation((): void => undefined);

        try {
            await runWithFileDialog("open", new Error("dialog cancelled"), async () => {
                await clickSourceButtonAfterDialog("File", "File Drag Source");

                await waitFor(() => {
                    expect(errorSpy).toHaveBeenCalledWith("dialog cancelled");
                });
            });
        } finally {
            errorSpy.mockRestore();
        }
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

describe("clipboardDemo image and file drag sources", () => {
    it("exposes a paintable content provider from the floppy image toggle drag source", async () => {
        await renderSourceType("Image");
        const floppy = await screen.findByName("image_floppy", { as: Gtk.ToggleButton });
        await userEvent.click(floppy);

        await waitFor(() => {
            expect(floppy).toBePressed();
        });

        const dragSource = queryController(floppy, Gtk.DragSource);
        expect(dragSource).toBeInstanceOf(Gtk.DragSource);
        const provider = dragSource?.emit("prepare", 0, 0) as Gdk.ContentProvider | null;
        expect(provider).toBeInstanceOf(Gdk.ContentProvider);
        expect(provider?.refFormats().containGtype(GObject.typeFromName("GdkPaintable"))).toBe(true);
    });

    it("exposes a GFile content provider from the File source drag source after a file is chosen", async () => {
        await runWithFileDialog("open", Gio.File.newForPath(join(TEMP_DIR, "dragged.txt")), async () => {
            await clickSourceButtonAfterDialog("File", "File Drag Source");

            const sourceButton = await screen.findByRole(Gtk.AccessibleRole.BUTTON, {
                name: "File Drag Source",
                as: Gtk.Button,
            });

            const dragSource = queryController(sourceButton, Gtk.DragSource);
            expect(dragSource).toBeInstanceOf(Gtk.DragSource);
            const provider = dragSource?.emit("prepare", 0, 0) as Gdk.ContentProvider | null;
            expect(provider).toBeInstanceOf(Gdk.ContentProvider);
            expect(provider?.refFormats().containGtype(GObject.typeFromName("GFile"))).toBe(true);
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
