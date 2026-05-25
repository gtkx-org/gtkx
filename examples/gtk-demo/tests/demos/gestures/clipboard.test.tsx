import * as Gdk from "@gtkx/ffi/gdk";
import * as Gio from "@gtkx/ffi/gio";
import * as GObject from "@gtkx/ffi/gobject";
import * as Gtk from "@gtkx/ffi/gtk";
import { act, screen, screenshot, userEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import { clipboardDemo } from "../../../src/demos/gestures/clipboard.js";
import { renderDemo } from "../../test-utils.js";

const findButtonByLabel = async (label: string): Promise<Gtk.Button> =>
    (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: label })) as Gtk.Button;

const switchSourceType = async (type: "Text" | "Color" | "Image" | "File" | "Folder"): Promise<void> => {
    const dropdown = (await screen.findByName("source-type")) as Gtk.DropDown;
    const items = ["Text", "Color", "Image", "File", "Folder"];
    await userEvent.selectOptions(dropdown, items.indexOf(type));
};

const getDefaultClipboard = (): Gdk.Clipboard => {
    const clipboard = Gdk.Display.getDefault()?.getClipboard();
    expect(clipboard).toBeInstanceOf(Gdk.Clipboard);
    return clipboard as Gdk.Clipboard;
};

const populateClipboardString = async (text: string): Promise<void> => {
    const clipboard = getDefaultClipboard();
    const value = new GObject.Value();
    value.init(GObject.Type.STRING);
    value.setString(text);
    await act(() => clipboard.set(value));
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
    await act(() => clipboard.set(value));
};

const populateClipboardFile = async (): Promise<void> => {
    const clipboard = getDefaultClipboard();
    const file = Gio.fileNewForPath("/tmp");
    const value = new GObject.Value();
    value.init(GObject.typeFromName("GFile"));
    value.setObject(file);
    await act(() => clipboard.set(value));
};

const makeRgbaValue = (r: number, g: number, b: number, a: number): GObject.Value => {
    const rgba = new Gdk.RGBA();
    rgba.red = r;
    rgba.green = g;
    rgba.blue = b;
    rgba.alpha = a;
    const value = new GObject.Value();
    value.init(GObject.typeFromName("GdkRGBA"));
    value.setBoxed(rgba);
    return value;
};

const makeFileValue = (path: string): GObject.Value => {
    const file = Gio.fileNewForPath(path);
    const value = new GObject.Value();
    value.init(GObject.typeFromName("GFile"));
    value.setObject(file);
    return value;
};

const makeIntValue = (n: number): GObject.Value => {
    const value = new GObject.Value();
    value.init(GObject.Type.INT);
    value.setInt(n);
    return value;
};

const makeStringValue = (text: string): GObject.Value => {
    const value = new GObject.Value();
    value.init(GObject.Type.STRING);
    value.setString(text);
    return value;
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
    it("renders the intro label, the text source entry initialised to 'Copy this!' and the Copy/Paste buttons", async () => {
        await renderDemo(clipboardDemo);
        expect(await screen.findByText(/^“Copy” will copy/)).toBeInstanceOf(Gtk.Widget);
        const entry = (await screen.findByName("source-entry")) as Gtk.Entry;
        expect(entry.getText()).toBe("Copy this!");
        expect(await findButtonByLabel("_Copy")).toBeInstanceOf(Gtk.Button);
        expect(await findButtonByLabel("_Paste")).toBeInstanceOf(Gtk.Button);
    });

    it("renders three image toggle buttons on the image source page", async () => {
        await renderDemo(clipboardDemo);
        expect(await screen.findByName("image_rose")).toBeInstanceOf(Gtk.ToggleButton);
        expect(await screen.findByName("image_floppy")).toBeInstanceOf(Gtk.ToggleButton);
        expect(await screen.findByName("image_logo")).toBeInstanceOf(Gtk.ToggleButton);
    });

    it("includes a GtkColorDialogButton for the Color source page", async () => {
        await renderDemo(clipboardDemo);
        const colorButton = await screen.findByName("color-button");
        expect(colorButton).toBeInstanceOf(Gtk.ColorDialogButton);
    });

    it("renders the source GtkStack initialised to the 'Text' page", async () => {
        await renderDemo(clipboardDemo);
        const sourceStack = (await screen.findByName("source-stack")) as Gtk.Stack;
        expect(sourceStack.getVisibleChildName()).toBe("Text");
    });
});

describe("clipboardDemo entry interactions", () => {
    it("updates the entry text when the user types", async () => {
        await renderDemo(clipboardDemo);
        const entry = (await screen.findByName("source-entry")) as Gtk.Entry;
        await userEvent.clear(entry);
        await userEvent.type(entry, "hello clipboard");
        expect(entry.getText()).toBe("hello clipboard");
    });

    it("disables the copy button when the text source is cleared", async () => {
        await renderDemo(clipboardDemo);
        const entry = (await screen.findByName("source-entry")) as Gtk.Entry;
        const copyButton = await findButtonByLabel("_Copy");
        expect(copyButton.getSensitive()).toBe(true);
        await userEvent.clear(entry);
        await waitFor(() => expect(copyButton.getSensitive()).toBe(false));
    });

    it("re-enables the copy button when the user types text after clearing the source", async () => {
        await renderDemo(clipboardDemo);
        const entry = (await screen.findByName("source-entry")) as Gtk.Entry;
        const copyButton = await findButtonByLabel("_Copy");
        await userEvent.clear(entry);
        await waitFor(() => expect(copyButton.getSensitive()).toBe(false));
        await userEvent.type(entry, "retyped");
        await waitFor(() => expect(copyButton.getSensitive()).toBe(true));
    });
});

describe("clipboardDemo source type switching", () => {
    it("switches the source stack to the Color page when Color is selected", async () => {
        await renderDemo(clipboardDemo);
        await switchSourceType("Color");
        const stack = (await screen.findByName("source-stack")) as Gtk.Stack;
        await waitFor(() => expect(stack.getVisibleChildName()).toBe("Color"));
    });

    it("switches the source stack to the Image page when Image is selected", async () => {
        await renderDemo(clipboardDemo);
        await switchSourceType("Image");
        const stack = (await screen.findByName("source-stack")) as Gtk.Stack;
        await waitFor(() => expect(stack.getVisibleChildName()).toBe("Image"));
    });

    it("switches the source stack to the File page when File is selected and disables Copy until a file is chosen", async () => {
        await renderDemo(clipboardDemo);
        await switchSourceType("File");
        const stack = (await screen.findByName("source-stack")) as Gtk.Stack;
        await waitFor(() => expect(stack.getVisibleChildName()).toBe("File"));
        const copyButton = await findButtonByLabel("_Copy");
        await waitFor(() => expect(copyButton.getSensitive()).toBe(false));
    });

    it("switches the source stack to the Folder page when Folder is selected and disables Copy until a folder is chosen", async () => {
        await renderDemo(clipboardDemo);
        await switchSourceType("Folder");
        const stack = (await screen.findByName("source-stack")) as Gtk.Stack;
        await waitFor(() => expect(stack.getVisibleChildName()).toBe("Folder"));
        const copyButton = await findButtonByLabel("_Copy");
        await waitFor(() => expect(copyButton.getSensitive()).toBe(false));
    });
});

describe("clipboardDemo image source", () => {
    it("activates the floppy buddy image toggle when clicked and updates the selected image", async () => {
        await renderDemo(clipboardDemo);
        await switchSourceType("Image");
        const floppy = (await screen.findByName("image_floppy")) as Gtk.ToggleButton;
        await userEvent.click(floppy);
        await waitFor(() => expect(floppy.getActive()).toBe(true));
    });

    it("activates the logo image toggle when clicked", async () => {
        await renderDemo(clipboardDemo);
        await switchSourceType("Image");
        const logo = (await screen.findByName("image_logo")) as Gtk.ToggleButton;
        await userEvent.click(logo);
        await waitFor(() => expect(logo.getActive()).toBe(true));
    });
});

describe("clipboardDemo Copy button populates the clipboard", () => {
    it("copies a string when Copy is clicked with text selected", async () => {
        await renderDemo(clipboardDemo);
        const copyButton = await findButtonByLabel("_Copy");
        await userEvent.click(copyButton);
        await waitFor(() => {
            expect(getDefaultClipboard().getFormats().containGtype(GObject.Type.STRING)).toBe(true);
        });
    });

    it("copies an RGBA color when Copy is clicked with Color source selected", async () => {
        await renderDemo(clipboardDemo);
        await switchSourceType("Color");
        const copyButton = await findButtonByLabel("_Copy");
        await userEvent.click(copyButton);
        await waitFor(() => {
            expect(getDefaultClipboard().getFormats().containGtype(GObject.typeFromName("GdkRGBA"))).toBe(true);
        });
    });

    it("copies a paintable when Copy is clicked with Image source selected", async () => {
        await renderDemo(clipboardDemo);
        await switchSourceType("Image");
        const copyButton = await findButtonByLabel("_Copy");
        await userEvent.click(copyButton);
        await waitFor(() => {
            expect(getDefaultClipboard().getFormats().containGtype(GObject.typeFromName("GdkPaintable"))).toBe(true);
        });
    });
});

describe("clipboardDemo Paste button updates pasted content", () => {
    it("shows pasted Text when the clipboard holds a string", async () => {
        await renderDemo(clipboardDemo);
        await populateClipboardString("clipboard string");
        const pasteButton = await findButtonByLabel("_Paste");
        await waitFor(() => expect(pasteButton.getSensitive()).toBe(true));
        await userEvent.click(pasteButton);
        const label = (await screen.findByName("paste-type-label")) as Gtk.Label;
        await waitFor(() => expect(label.getLabel()).toBe("Text"));
    });

    it("shows pasted Color when the clipboard holds an RGBA value", async () => {
        await renderDemo(clipboardDemo);
        await populateClipboardRgba();
        const pasteButton = await findButtonByLabel("_Paste");
        await waitFor(() => expect(pasteButton.getSensitive()).toBe(true));
        await userEvent.click(pasteButton);
        const label = (await screen.findByName("paste-type-label")) as Gtk.Label;
        await waitFor(() => expect(label.getLabel()).toBe("Color"));
    });

    it("shows pasted content when the clipboard holds a GFile (resolves through paste pipeline)", async () => {
        await renderDemo(clipboardDemo);
        await populateClipboardFile();
        const pasteButton = await findButtonByLabel("_Paste");
        await waitFor(() => expect(pasteButton.getSensitive()).toBe(true));
        await userEvent.click(pasteButton);
        const label = (await screen.findByName("paste-type-label")) as Gtk.Label;
        await waitFor(() => expect(label.getLabel()).not.toBe(""));
    });
});

describe("clipboardDemo paste-box drop handler", () => {
    it("updates the pasted content label to 'Text' when a string is dropped", async () => {
        await renderDemo(clipboardDemo);
        const pasteBox = (await screen.findByName("paste-box")) as Gtk.Box;
        await userEvent.drop(pasteBox, makeStringValue("dropped text"));
        const label = (await screen.findByName("paste-type-label")) as Gtk.Label;
        await waitFor(() => expect(label.getLabel()).toBe("Text"));
    });

    it("updates the pasted content label to 'Color' when an RGBA is dropped", async () => {
        await renderDemo(clipboardDemo);
        const pasteBox = (await screen.findByName("paste-box")) as Gtk.Box;
        await userEvent.drop(pasteBox, makeRgbaValue(0.5, 0.2, 0.8, 1));
        const label = (await screen.findByName("paste-type-label")) as Gtk.Label;
        await waitFor(() => expect(label.getLabel()).toBe("Color"));
    });

    it("updates the pasted content label to 'File' when a GFile is dropped", async () => {
        await renderDemo(clipboardDemo);
        const pasteBox = (await screen.findByName("paste-box")) as Gtk.Box;
        await userEvent.drop(pasteBox, makeFileValue("/tmp"));
        const label = (await screen.findByName("paste-type-label")) as Gtk.Label;
        await waitFor(() => expect(label.getLabel()).toBe("File"));
    });
});

describe("clipboardDemo drag sources", () => {
    it("registers a drag source on the text entry by exposing its drag content via userEvent", async () => {
        await renderDemo(clipboardDemo);
        const entry = (await screen.findByName("source-entry")) as Gtk.Entry;
        const pasteBox = (await screen.findByName("paste-box")) as Gtk.Box;
        await userEvent.dragAndDrop(entry, pasteBox, makeStringValue("Copy this!"));
        const label = (await screen.findByName("paste-type-label")) as Gtk.Label;
        await waitFor(() => expect(label.getLabel()).toBe("Text"));
    });

    it("registers a drag source on the color button by exposing its color via userEvent", async () => {
        await renderDemo(clipboardDemo);
        await switchSourceType("Color");
        const colorButton = (await screen.findByName("color-button")) as Gtk.ColorDialogButton;
        const pasteBox = (await screen.findByName("paste-box")) as Gtk.Box;
        await userEvent.dragAndDrop(colorButton, pasteBox, makeRgbaValue(0.5, 0.5, 0.5, 1));
        const label = (await screen.findByName("paste-type-label")) as Gtk.Label;
        await waitFor(() => expect(label.getLabel()).toBe("Color"));
    });
});

describe("clipboardDemo paste content rendering", () => {
    it("paints the paste color swatch after a Color is dropped on the paste box", async () => {
        await renderDemo(clipboardDemo);
        const pasteBox = (await screen.findByName("paste-box")) as Gtk.Box;
        await userEvent.drop(pasteBox, makeRgbaValue(0.9, 0.1, 0.5, 1));
        const label = (await screen.findByName("paste-type-label")) as Gtk.Label;
        await waitFor(() => expect(label.getLabel()).toBe("Color"));
        const window = (await screen.findByRole(Gtk.AccessibleRole.WINDOW)) as Gtk.Window;
        await act(() => window.setVisible(true));
        await screenshot(window);
        expect(label.getLabel()).toBe("Color");
    });
});

describe("clipboardDemo invalid image path", () => {
    it("places a paintable on the clipboard when copying an image source", async () => {
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        try {
            await renderDemo(clipboardDemo);
            await switchSourceType("Image");
            const copyButton = await findButtonByLabel("_Copy");
            await userEvent.click(copyButton);
            await waitFor(() => {
                expect(getDefaultClipboard().getFormats().containGtype(GObject.typeFromName("GdkPaintable"))).toBe(
                    true,
                );
            });
        } finally {
            errorSpy.mockRestore();
        }
    });
});

describe("clipboardDemo paste after copy round-trip", () => {
    it("shows pasted Image when the clipboard holds a paintable copied from the demo", async () => {
        await renderDemo(clipboardDemo);
        await switchSourceType("Image");
        const copyButton = await findButtonByLabel("_Copy");
        await userEvent.click(copyButton);
        const pasteButton = await findButtonByLabel("_Paste");
        await waitFor(() => expect(pasteButton.getSensitive()).toBe(true));
        await userEvent.click(pasteButton);
        const label = (await screen.findByName("paste-type-label")) as Gtk.Label;
        await waitFor(() => expect(label.getLabel()).toBe("Image"));
    });
});

const runWithFileDialog = async <T,>(
    method: "open" | "selectFolder",
    result: Gio.File | Error,
    body: () => Promise<T>,
): Promise<{ value: T; dialogSpy: ReturnType<typeof vi.spyOn> }> => {
    const dialogSpy = vi.spyOn(Gtk.FileDialog.prototype, method);
    if (result instanceof Error) dialogSpy.mockRejectedValue(result);
    else dialogSpy.mockResolvedValue(result);
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
    await renderDemo(clipboardDemo);
    await switchSourceType(kind);
    const sourceButton = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: label })) as Gtk.Button;
    await userEvent.click(sourceButton);
};

describe("clipboardDemo file source selection", () => {
    it("opens a Gtk.FileDialog and updates the source file when the File button is clicked", async () => {
        await runWithFileDialog("open", Gio.fileNewForPath("/tmp/fake-file.txt"), async () => {
            await clickSourceButtonAfterDialog("File", "File Drag Source");
            const copyButton = await findButtonByLabel("_Copy");
            await waitFor(() => expect(copyButton.getSensitive()).toBe(true));
        });
    });

    it("opens a Gtk.FileDialog folder picker when the Folder button is clicked", async () => {
        await runWithFileDialog("selectFolder", Gio.fileNewForPath("/tmp"), async () => {
            await clickSourceButtonAfterDialog("Folder", "Folder Drag Source");
            const copyButton = await findButtonByLabel("_Copy");
            await waitFor(() => expect(copyButton.getSensitive()).toBe(true));
        });
    });

    it("logs an error when the File dialog rejects", async () => {
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        try {
            await runWithFileDialog("open", new Error("dialog cancelled"), async () => {
                await clickSourceButtonAfterDialog("File", "File Drag Source");
                await waitFor(() => expect(errorSpy).toHaveBeenCalledWith("dialog cancelled"));
            });
        } finally {
            errorSpy.mockRestore();
        }
    });

    it("copies a file to the clipboard after the file dialog selects a file", async () => {
        await runWithFileDialog("open", Gio.fileNewForPath("/tmp/some-file.txt"), async () => {
            await clickSourceButtonAfterDialog("File", "File Drag Source");
            const copyButton = await findButtonByLabel("_Copy");
            await waitFor(() => expect(copyButton.getSensitive()).toBe(true));
            await userEvent.click(copyButton);
            await waitFor(() => {
                expect(getDefaultClipboard().getFormats().containGtype(GObject.typeFromName("GFile"))).toBe(true);
            });
        });
    });
});

describe("clipboardDemo paste-box drop with object types", () => {
    it("updates the pasted content label to 'File' when a GFile object is dropped via the OBJECT branch", async () => {
        await renderDemo(clipboardDemo);
        const pasteBox = (await screen.findByName("paste-box")) as Gtk.Box;
        await userEvent.drop(pasteBox, makeFileValue("/etc"));
        const label = (await screen.findByName("paste-type-label")) as Gtk.Label;
        await waitFor(() => expect(label.getLabel()).toBe("File"));
    });

    it("returns false from the drop handler when the dropped value is unrecognized", async () => {
        await renderDemo(clipboardDemo);
        const pasteBox = (await screen.findByName("paste-box")) as Gtk.Box;
        await userEvent.drop(pasteBox, makeIntValue(42));
        const label = (await screen.findByName("paste-type-label")) as Gtk.Label;
        expect(label.getLabel()).toBe("");
    });
});
