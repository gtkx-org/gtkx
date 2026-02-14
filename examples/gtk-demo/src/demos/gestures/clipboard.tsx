import { getNativeInterface } from "@gtkx/ffi";
import type { Context } from "@gtkx/ffi/cairo";
import * as Gdk from "@gtkx/ffi/gdk";
import * as Gio from "@gtkx/ffi/gio";
import * as GObject from "@gtkx/ffi/gobject";
import * as Gtk from "@gtkx/ffi/gtk";
import {
    GtkBox,
    GtkButton,
    GtkColorDialogButton,
    GtkDragSource,
    GtkDrawingArea,
    GtkDropDown,
    GtkDropTarget,
    GtkEntry,
    GtkImage,
    GtkLabel,
    GtkSeparator,
    GtkStack,
    GtkToggleButton,
    x,
} from "@gtkx/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import gtkLogoSvgPath from "../drawing/gtk-logo.svg";
import type { Demo, DemoProps } from "../types.js";
import sourceCode from "./clipboard.tsx?raw";
import floppyBuddyPath from "./floppybuddy.gif";
import portlandRosePath from "./portland-rose.jpg";

type SourceType = "Text" | "Color" | "Image" | "File" | "Folder";
type PastedContentType = "" | "Text" | "Color" | "Image" | "File";

interface PastedContent {
    type: PastedContentType;
    text?: string;
    color?: Gdk.RGBA;
    paintable?: Gdk.Paintable;
    filePath?: string;
}

let gdkRgbaTypeCache: number | null = null;
const getGdkRgbaType = () => {
    if (gdkRgbaTypeCache === null) {
        gdkRgbaTypeCache = GObject.typeFromName("GdkRGBA");
    }
    return gdkRgbaTypeCache;
};

let gdkPaintableTypeCache: number | null = null;
const getGdkPaintableType = () => {
    if (gdkPaintableTypeCache === null) {
        gdkPaintableTypeCache = GObject.typeFromName("GdkPaintable");
    }
    return gdkPaintableTypeCache;
};

let gFileTypeCache: number | null = null;
const getGFileType = () => {
    if (gFileTypeCache === null) {
        gFileTypeCache = GObject.typeFromName("GFile");
    }
    return gFileTypeCache;
};

const SOURCE_TYPES: SourceType[] = ["Text", "Color", "Image", "File", "Folder"];

function drawColorSwatch(cr: Context, width: number, height: number, rgba: Gdk.RGBA): void {
    cr.setSourceRgba(rgba.getRed(), rgba.getGreen(), rgba.getBlue(), rgba.getAlpha());
    cr.rectangle(0, 0, width, height);
    cr.fill();
}

const ClipboardDemo = ({ window }: DemoProps) => {
    const [sourceType, setSourceType] = useState<SourceType>("Text");
    const [sourceText, setSourceText] = useState("Copy this!");
    const [sourceColor, setSourceColor] = useState<Gdk.RGBA>(
        new Gdk.RGBA({ red: 0.5, green: 0.0, blue: 0.5, alpha: 1.0 }),
    );
    const [selectedImage, setSelectedImage] = useState(0);
    const [sourceFile, setSourceFile] = useState<Gio.File | null>(null);
    const [pastedContent, setPastedContent] = useState<PastedContent>({ type: "" });
    const [canPaste, setCanPaste] = useState(false);

    const portlandRoseTexture = useMemo(() => Gdk.Texture.newFromFilename(portlandRosePath), []);
    const floppyBuddyTexture = useMemo(() => Gdk.Texture.newFromFilename(floppyBuddyPath), []);
    const gtkLogoSvgTexture = useMemo(() => Gdk.Texture.newFromFilename(gtkLogoSvgPath), []);
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
            formats.containGtype(getGdkPaintableType()) ||
            formats.containGtype(getGFileType()) ||
            formats.containMimeType("image/png");
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
        } else if (sourceType === "File" || sourceType === "Folder") {
            setCanCopy(sourceFile !== null);
        } else {
            setCanCopy(true);
        }
    }, [sourceType, sourceText, sourceFile]);

    const createTextDragProvider = useCallback(() => {
        return Gdk.ContentProvider.newForValue(GObject.Value.newFromString(sourceText));
    }, [sourceText]);

    const createColorDragProvider = useCallback(() => {
        return Gdk.ContentProvider.newForValue(GObject.Value.newFromBoxed(sourceColor));
    }, [sourceColor]);

    const createImageDragProvider = useCallback(() => {
        const paths = [portlandRosePath, floppyBuddyPath, gtkLogoSvgPath];
        const path = paths[selectedImage] ?? portlandRosePath;
        try {
            const texture = Gdk.Texture.newFromFilename(path);
            const value = new GObject.Value();
            value.init(GObject.typeFromName("GdkPaintable"));
            value.setObject(texture);
            return Gdk.ContentProvider.newForValue(value);
        } catch {
            return null;
        }
    }, [selectedImage]);

    const createFileDragProvider = useCallback(() => {
        if (sourceFile) {
            return Gdk.ContentProvider.newForValue(GObject.Value.newFromObject(sourceFile));
        }
        return null;
    }, [sourceFile]);

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
            const paths = [portlandRosePath, floppyBuddyPath, gtkLogoSvgPath];
            const path = paths[selectedImage] ?? portlandRosePath;
            try {
                const texture = Gdk.Texture.newFromFilename(path);
                const value = new GObject.Value();
                value.init(GObject.typeFromName("GdkPaintable"));
                value.setObject(texture);
                clipboard.setValue(value);
            } catch {}
        } else if ((sourceType === "File" || sourceType === "Folder") && sourceFile) {
            const value = GObject.Value.newFromObject(sourceFile);
            clipboard.setValue(value);
        }
    }, [sourceType, sourceText, sourceColor, selectedImage, sourceFile, getClipboard]);

    const handlePaste = useCallback(async () => {
        const clipboard = getClipboard();
        if (!clipboard) return;

        const formats = clipboard.getFormats();

        try {
            if (formats.containMimeType("image/png")) {
                const texture = await clipboard.readTextureAsync();
                if (texture) {
                    const paintable = getNativeInterface(texture, Gdk.Paintable);
                    if (paintable) {
                        setPastedContent({ type: "Image", paintable });
                    }
                    return;
                }
            }

            if (formats.containGtype(getGdkPaintableType())) {
                const value = await clipboard.readValueAsync(getGdkPaintableType(), 0);
                const obj = value.getObject();
                if (obj) {
                    const paintable = getNativeInterface(obj, Gdk.Paintable);
                    if (paintable) {
                        setPastedContent({ type: "Image", paintable });
                    }
                    return;
                }
            }

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
                    const file = obj as Gio.File;
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
            const file = await dialog.openAsync(window.current);
            setSourceFile(file);
        } catch {}
    }, [window]);

    const handleFolderSelect = useCallback(async () => {
        const dialog = new Gtk.FileDialog();
        try {
            const file = await dialog.selectFolderAsync(window.current);
            setSourceFile(file);
        } catch {}
    }, [window]);

    const handleDrop = useCallback((value: GObject.Value) => {
        const obj = value.getObject();
        if (obj) {
            const paintable = getNativeInterface(obj, Gdk.Paintable);
            if (paintable) {
                setPastedContent({ type: "Image", paintable });
                return true;
            }
            if (obj instanceof Gio.File) {
                setPastedContent({ type: "File", filePath: obj.getPath() ?? obj.getUri() });
                return true;
            }
        }
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
            return true;
        }
        const text = value.getString();
        if (text) {
            setPastedContent({ type: "Text", text });
            return true;
        }
        return false;
    }, []);

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
                    '"Copy" will copy the selected data the clipboard, "Paste" will show the current clipboard contents. You can also drag the data to the bottom.'
                }
                wrap
                maxWidthChars={40}
            />

            <GtkBox spacing={12}>
                <GtkDropDown valign={Gtk.Align.CENTER} onSelectionChanged={(id) => setSourceType(id as SourceType)}>
                    {SOURCE_TYPES.map((type) => (
                        <x.ListItem key={type} id={type} value={type} />
                    ))}
                </GtkDropDown>

                <GtkStack page={sourceType} vexpand>
                    <x.StackPage id="Text">
                        <GtkEntry
                            text={sourceText}
                            valign={Gtk.Align.CENTER}
                            accessibleLabel="Text to copy"
                            onChanged={(entry) => setSourceText(entry.getText())}
                        >
                            <GtkDragSource onPrepare={createTextDragProvider} actions={Gdk.DragAction.COPY} />
                        </GtkEntry>
                    </x.StackPage>
                    <x.StackPage id="Color">
                        <GtkColorDialogButton
                            rgba={sourceColor}
                            valign={Gtk.Align.CENTER}
                            accessibleLabel="Color to copy"
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
                        >
                            <GtkDragSource onPrepare={createColorDragProvider} actions={Gdk.DragAction.COPY} />
                        </GtkColorDialogButton>
                    </x.StackPage>
                    <x.StackPage id="Image">
                        <GtkBox valign={Gtk.Align.CENTER} cssClasses={["linked"]}>
                            <GtkToggleButton
                                accessibleLabel="Portland Rose"
                                active={selectedImage === 0}
                                onToggled={(btn) => {
                                    if (btn.getActive()) setSelectedImage(0);
                                }}
                            >
                                <GtkImage paintable={portlandRoseTexture} pixelSize={48} />
                                <GtkDragSource onPrepare={createImageDragProvider} actions={Gdk.DragAction.COPY} />
                            </GtkToggleButton>
                            <GtkToggleButton
                                accessibleLabel="Floppy Buddy"
                                active={selectedImage === 1}
                                onToggled={(btn) => {
                                    if (btn.getActive()) setSelectedImage(1);
                                }}
                            >
                                <GtkImage paintable={floppyBuddyTexture} pixelSize={48} />
                                <GtkDragSource onPrepare={createImageDragProvider} actions={Gdk.DragAction.COPY} />
                            </GtkToggleButton>
                            <GtkToggleButton
                                accessibleLabel="GTK Logo"
                                active={selectedImage === 2}
                                onToggled={(btn) => {
                                    if (btn.getActive()) setSelectedImage(2);
                                }}
                            >
                                <GtkImage paintable={gtkLogoSvgTexture} pixelSize={48} />
                                <GtkDragSource onPrepare={createImageDragProvider} actions={Gdk.DragAction.COPY} />
                            </GtkToggleButton>
                        </GtkBox>
                    </x.StackPage>
                    <x.StackPage id="File">
                        <GtkButton
                            valign={Gtk.Align.CENTER}
                            accessibleLabel="Select file"
                            onClicked={() => void handleFileSelect()}
                        >
                            <GtkLabel
                                label={sourceFile ? (sourceFile.getPath() ?? "\u2014") : "\u2014"}
                                xalign={0}
                                ellipsize={1}
                            />
                            <GtkDragSource
                                onPrepare={createFileDragProvider}
                                actions={Gdk.DragAction.COPY}
                                propagationPhase={Gtk.PropagationPhase.CAPTURE}
                            />
                        </GtkButton>
                    </x.StackPage>
                    <x.StackPage id="Folder">
                        <GtkButton
                            valign={Gtk.Align.CENTER}
                            accessibleLabel="Select folder"
                            onClicked={() => void handleFolderSelect()}
                        >
                            <GtkLabel
                                label={sourceFile ? (sourceFile.getPath() ?? "\u2014") : "\u2014"}
                                xalign={0}
                                ellipsize={1}
                            />
                            <GtkDragSource
                                onPrepare={createFileDragProvider}
                                actions={Gdk.DragAction.COPY}
                                propagationPhase={Gtk.PropagationPhase.CAPTURE}
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
                <GtkDropTarget
                    types={[getGdkPaintableType(), getGFileType(), getGdkRgbaType(), GObject.Type.STRING]}
                    actions={Gdk.DragAction.COPY}
                    onDrop={(value: GObject.Value) => handleDrop(value)}
                />
                <GtkButton
                    label="_Paste"
                    useUnderline
                    valign={Gtk.Align.CENTER}
                    sensitive={canPaste}
                    onClicked={() => void handlePaste()}
                />
                <GtkLabel label={pastedContent.type} xalign={0} />
                <GtkStack page={pastedContent.type} halign={Gtk.Align.END} valign={Gtk.Align.CENTER}>
                    <x.StackPage id="">
                        <GtkLabel label="" />
                    </x.StackPage>
                    <x.StackPage id="Text">
                        <GtkLabel
                            label={pastedContent.text ?? ""}
                            halign={Gtk.Align.END}
                            valign={Gtk.Align.CENTER}
                            xalign={0}
                            ellipsize={3}
                        />
                    </x.StackPage>
                    <x.StackPage id="Image">
                        {pastedContent.paintable ? (
                            <GtkImage
                                paintable={pastedContent.paintable}
                                halign={Gtk.Align.END}
                                valign={Gtk.Align.CENTER}
                                pixelSize={48}
                            />
                        ) : (
                            <GtkLabel label="" />
                        )}
                    </x.StackPage>
                    <x.StackPage id="Color">
                        <GtkDrawingArea
                            contentWidth={32}
                            contentHeight={32}
                            halign={Gtk.Align.END}
                            valign={Gtk.Align.CENTER}
                            onDraw={(cr, w, h) => {
                                const c = pastedContent.color;
                                if (c) {
                                    drawColorSwatch(cr, w, h, c);
                                }
                            }}
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
