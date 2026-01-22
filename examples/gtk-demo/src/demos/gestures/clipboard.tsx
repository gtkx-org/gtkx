import { getNativeObject } from "@gtkx/ffi";
import * as Gdk from "@gtkx/ffi/gdk";
import * as Gio from "@gtkx/ffi/gio";
import * as GObject from "@gtkx/ffi/gobject";
import * as Gtk from "@gtkx/ffi/gtk";
import {
    GtkBox,
    GtkButton,
    GtkColorDialogButton,
    GtkDropDown,
    GtkEntry,
    GtkImage,
    GtkLabel,
    GtkSeparator,
    GtkStack,
    GtkToggleButton,
    useApplication,
    x,
} from "@gtkx/react";
import { useCallback, useEffect, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./clipboard.tsx?raw";

type SourceType = "Text" | "Color" | "Image" | "File";
type PastedContentType = "" | "Text" | "Color" | "File";

interface PastedContent {
    type: PastedContentType;
    text?: string;
    color?: Gdk.RGBA;
    filePath?: string;
}

let gdkRgbaTypeCache: number | null = null;
const getGdkRgbaType = () => {
    if (gdkRgbaTypeCache === null) {
        gdkRgbaTypeCache = GObject.typeFromName("GdkRGBA");
    }
    return gdkRgbaTypeCache;
};

let gFileTypeCache: number | null = null;
const getGFileType = () => {
    if (gFileTypeCache === null) {
        gFileTypeCache = GObject.typeFromName("GFile");
    }
    return gFileTypeCache;
};

const SOURCE_TYPES: SourceType[] = ["Text", "Color", "Image", "File"];

const ClipboardDemo = () => {
    const app = useApplication();
    const [sourceType, setSourceType] = useState<SourceType>("Text");
    const [sourceText, setSourceText] = useState("Copy this!");
    const [sourceColor, setSourceColor] = useState<Gdk.RGBA>(
        new Gdk.RGBA({ red: 0.5, green: 0.0, blue: 0.5, alpha: 1.0 }),
    );
    const [selectedImage, setSelectedImage] = useState(0);
    const [sourceFile, setSourceFile] = useState<Gio.File | null>(null);
    const [pastedContent, setPastedContent] = useState<PastedContent>({ type: "" });
    const [canPaste, setCanPaste] = useState(false);
    const [canCopy, setCanCopy] = useState(true);

    const getClipboard = useCallback(() => {
        const display = Gdk.Display.getDefault();
        return display?.getClipboard() ?? null;
    }, []);

    const updatePasteButtonSensitivity = useCallback(() => {
        const clipboard = getClipboard();
        if (!clipboard) {
            setCanPaste(false);
            return;
        }

        const formats = clipboard.getFormats();
        const canPasteContent =
            formats.containGtype(GObject.Type.STRING) ||
            formats.containGtype(getGdkRgbaType()) ||
            formats.containGtype(getGFileType());
        setCanPaste(canPasteContent);
    }, [getClipboard]);

    useEffect(() => {
        const clipboard = getClipboard();
        if (!clipboard) return;

        updatePasteButtonSensitivity();
        clipboard.connect("changed", () => {
            updatePasteButtonSensitivity();
        });
    }, [getClipboard, updatePasteButtonSensitivity]);

    useEffect(() => {
        if (sourceType === "Text") {
            setCanCopy(sourceText.length > 0);
        } else if (sourceType === "File") {
            setCanCopy(sourceFile !== null);
        } else {
            setCanCopy(true);
        }
    }, [sourceType, sourceText, sourceFile]);

    const handleCopy = useCallback(() => {
        const clipboard = getClipboard();
        if (!clipboard) return;

        if (sourceType === "Text") {
            const value = GObject.Value.newFromString(sourceText);
            clipboard.setValue(value);
        } else if (sourceType === "Color") {
            const value = GObject.Value.newFromBoxed(sourceColor);
            clipboard.setValue(value);
        } else if (sourceType === "Image") {
            const iconNames = ["weather-clear-symbolic", "media-floppy-symbolic", "applications-games-symbolic"];
            const display = Gdk.Display.getDefault();
            if (display) {
                const iconTheme = Gtk.IconTheme.getForDisplay(display);
                const paintable = iconTheme.lookupIcon(
                    iconNames[selectedImage] ?? "weather-clear-symbolic",
                    64,
                    1,
                    Gtk.TextDirection.NONE,
                    0,
                );
                if (paintable) {
                    const value = GObject.Value.newFromObject(paintable);
                    clipboard.setValue(value);
                }
            }
        } else if (sourceType === "File" && sourceFile) {
            const fileAsGObject = getNativeObject(sourceFile.handle, GObject.GObject);
            const value = GObject.Value.newFromObject(fileAsGObject);
            clipboard.setValue(value);
        }
    }, [sourceType, sourceText, sourceColor, selectedImage, sourceFile, getClipboard]);

    const handlePaste = useCallback(async () => {
        const clipboard = getClipboard();
        if (!clipboard) return;

        const formats = clipboard.getFormats();

        try {
            if (formats.containGtype(getGdkRgbaType())) {
                const value = await clipboard.readValueAsync(getGdkRgbaType(), 0);
                const rgba = value.getBoxed(Gdk.RGBA);
                if (rgba) {
                    setPastedContent({
                        type: "Color",
                        color: new Gdk.RGBA({
                            red: rgba.getRed(),
                            green: rgba.getGreen(),
                            blue: rgba.getBlue(),
                            alpha: rgba.getAlpha(),
                        }),
                    });
                    return;
                }
            }

            if (formats.containGtype(getGFileType())) {
                const value = await clipboard.readValueAsync(getGFileType(), 0);
                const obj = value.getObject();
                if (obj) {
                    const file = getNativeObject(obj.handle, Gio.File);
                    setPastedContent({ type: "File", filePath: file.getPath() ?? file.getUri() });
                    return;
                }
            }

            if (formats.containGtype(GObject.Type.STRING)) {
                const text = await clipboard.readTextAsync();
                if (text !== null) {
                    setPastedContent({ type: "Text", text });
                    return;
                }
            }
        } catch {}
    }, [getClipboard]);

    const handleFileSelect = useCallback(async () => {
        const dialog = new Gtk.FileDialog();
        try {
            const file = await dialog.openAsync(app.getActiveWindow() ?? undefined);
            setSourceFile(file);
        } catch {}
    }, [app]);

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={12}
            marginStart={12}
            marginEnd={12}
            marginTop={12}
            marginBottom={12}
        >
            <GtkLabel
                label={
                    '"Copy" will copy the selected data to the clipboard, "Paste" will show the current clipboard contents.'
                }
                wrap
                maxWidthChars={40}
            />

            <GtkBox spacing={12}>
                <GtkDropDown valign={Gtk.Align.CENTER} onSelectionChanged={(id) => setSourceType(id as SourceType)}>
                    {SOURCE_TYPES.map((type) => (
                        <x.SimpleListItem key={type} id={type} value={type} />
                    ))}
                </GtkDropDown>

                <GtkStack page={sourceType} vexpand hexpand>
                    <x.StackPage id="Text">
                        <GtkEntry
                            text={sourceText}
                            valign={Gtk.Align.CENTER}
                            onChanged={(entry) => setSourceText(entry.getText())}
                        />
                    </x.StackPage>
                    <x.StackPage id="Color">
                        <GtkColorDialogButton
                            rgba={sourceColor}
                            valign={Gtk.Align.CENTER}
                            onRgbaChanged={(rgba) =>
                                setSourceColor(
                                    new Gdk.RGBA({
                                        red: rgba.getRed(),
                                        green: rgba.getGreen(),
                                        blue: rgba.getBlue(),
                                        alpha: rgba.getAlpha(),
                                    }),
                                )
                            }
                        />
                    </x.StackPage>
                    <x.StackPage id="Image">
                        <GtkBox valign={Gtk.Align.CENTER} cssClasses={["linked"]}>
                            <GtkToggleButton
                                active={selectedImage === 0}
                                onToggled={(btn) => {
                                    if (btn.getActive()) setSelectedImage(0);
                                }}
                            >
                                <GtkImage iconName="weather-clear-symbolic" pixelSize={48} />
                            </GtkToggleButton>
                            <GtkToggleButton
                                active={selectedImage === 1}
                                onToggled={(btn) => {
                                    if (btn.getActive()) setSelectedImage(1);
                                }}
                            >
                                <GtkImage iconName="media-floppy-symbolic" pixelSize={48} />
                            </GtkToggleButton>
                            <GtkToggleButton
                                active={selectedImage === 2}
                                onToggled={(btn) => {
                                    if (btn.getActive()) setSelectedImage(2);
                                }}
                            >
                                <GtkImage iconName="applications-games-symbolic" pixelSize={48} />
                            </GtkToggleButton>
                        </GtkBox>
                    </x.StackPage>
                    <x.StackPage id="File">
                        <GtkButton valign={Gtk.Align.CENTER} onClicked={() => void handleFileSelect()}>
                            <GtkLabel
                                label={sourceFile ? (sourceFile.getPath() ?? "—") : "—"}
                                xalign={0}
                                ellipsize={1}
                            />
                        </GtkButton>
                    </x.StackPage>
                </GtkStack>

                <GtkButton
                    label="_Copy"
                    useUnderline
                    valign={Gtk.Align.CENTER}
                    sensitive={canCopy}
                    onClicked={handleCopy}
                />
            </GtkBox>

            <GtkSeparator />

            <GtkBox spacing={12}>
                <GtkButton
                    label="_Paste"
                    useUnderline
                    valign={Gtk.Align.CENTER}
                    sensitive={canPaste}
                    onClicked={() => void handlePaste()}
                />
                <GtkLabel label={pastedContent.type} xalign={0} />
                <GtkStack page={pastedContent.type} halign={Gtk.Align.END} valign={Gtk.Align.CENTER} hexpand>
                    <x.StackPage id="">
                        <GtkLabel label="" />
                    </x.StackPage>
                    <x.StackPage id="Text">
                        <GtkLabel
                            label={pastedContent.text ?? ""}
                            halign={Gtk.Align.END}
                            valign={Gtk.Align.CENTER}
                            xalign={0}
                            ellipsize={2}
                        />
                    </x.StackPage>
                    <x.StackPage id="Color">
                        <GtkColorDialogButton
                            dialog={new Gtk.ColorDialog()}
                            rgba={pastedContent.color ?? new Gdk.RGBA({ red: 1, green: 1, blue: 1, alpha: 1 })}
                            halign={Gtk.Align.END}
                            valign={Gtk.Align.CENTER}
                            sensitive={false}
                        />
                    </x.StackPage>
                    <x.StackPage id="File">
                        <GtkLabel
                            label={pastedContent.filePath ?? ""}
                            halign={Gtk.Align.END}
                            valign={Gtk.Align.CENTER}
                            xalign={0}
                            hexpand
                            ellipsize={1}
                        />
                    </x.StackPage>
                </GtkStack>
            </GtkBox>
        </GtkBox>
    );
};

export const clipboardDemo: Demo = {
    id: "clipboard",
    title: "Clipboard",
    description:
        "GdkClipboard is used for clipboard handling. This demo shows how to copy and paste text, images, colors or files to and from the clipboard.",
    keywords: ["clipboard", "copy", "paste", "GdkClipboard", "text", "image", "color", "file", "transfer"],
    component: ClipboardDemo,
    sourceCode,
};
