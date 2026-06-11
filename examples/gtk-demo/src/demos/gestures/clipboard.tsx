import type { Context } from "@gtkx/gi/cairo";
import * as Gdk from "@gtkx/gi/gdk";
import * as Gio from "@gtkx/gi/gio";
import type { GType } from "@gtkx/gi/gobject";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import {
    GtkBox,
    GtkButton,
    GtkColorDialogButton,
    GtkDragSource,
    GtkDropTarget,
    GtkEntry,
    GtkImage,
    GtkLabel,
    GtkSeparator,
    GtkStack,
    GtkStackPage,
    GtkToggleButton,
} from "@gtkx/jsx/gtk";
import { GtkDrawingArea, GtkDropDown, useProperty } from "@gtkx/react";
import { useState } from "react";
import type { Demo, DemoProps } from "../types.js";
import sourceCode from "./clipboard.tsx?raw";
import { path as floppyBuddyPath } from "./floppybuddy.gif";
import { path as demo4LogoPath } from "./org.gtk.Demo4.svg";
import { path as portlandRosePath } from "./portland-rose.jpg";

const setClipboardValue = (clipboard: Gdk.Clipboard, value: GObject.Value): void => clipboard.set(value);
const readTextureAsync = (clipboard: Gdk.Clipboard): Promise<Gdk.Texture | null> => clipboard.readTextureAsync(null);
const readValueAsync = (clipboard: Gdk.Clipboard, type: GType): Promise<GObject.Value> =>
    clipboard.readValueAsync(type, 0, null);

type SourceType = "Text" | "Color" | "Image" | "File" | "Folder";
type PastedContentType = "" | "Text" | "Color" | "Image" | "File";

interface PastedContent {
    type: PastedContentType;
    text?: string;
    color?: Gdk.RGBA;
    paintable?: Gdk.Paintable;
    filePath?: string;
}

const gdkRgbaType = Gdk.RGBA.prototype.__gtype__;
const gdkPaintableType = Gdk.Paintable.prototype.__gtype__;
const gfileType = Gio.File.prototype.__gtype__;
const gdkTextureType = Gdk.Texture.prototype.__gtype__;

const SOURCE_TYPES: SourceType[] = ["Text", "Color", "Image", "File", "Folder"];

function drawColorSwatch(cr: Context, width: number, height: number, rgba: Gdk.RGBA): void {
    cr.setSourceRgba(rgba.red, rgba.green, rgba.blue, rgba.alpha);
    cr.rectangle(0, 0, width, height);
    cr.fill();
}

const buildRgba = (red: number, green: number, blue: number, alpha: number): Gdk.RGBA => {
    const rgba = new Gdk.RGBA();
    rgba.red = red;
    rgba.green = green;
    rgba.blue = blue;
    rgba.alpha = alpha;
    return rgba;
};

function useClipboardState() {
    const [sourceType, setSourceType] = useState<SourceType>("Text");
    const [sourceText, setSourceText] = useState("Copy this!");
    const [sourceColor, setSourceColor] = useState<Gdk.RGBA>(buildRgba(128 / 255, 0, 128 / 255, 1));
    const [selectedImage, setSelectedImage] = useState(0);
    const [sourceFile, setSourceFile] = useState<Gio.File | null>(null);
    const [pastedContent, setPastedContent] = useState<PastedContent>({ type: "" });

    const canCopy =
        sourceType === "Text"
            ? sourceText.length > 0
            : sourceType === "File" || sourceType === "Folder"
              ? sourceFile !== null
              : true;

    return {
        sourceType,
        setSourceType,
        sourceText,
        setSourceText,
        sourceColor,
        setSourceColor,
        selectedImage,
        setSelectedImage,
        sourceFile,
        setSourceFile,
        pastedContent,
        setPastedContent,
        canCopy,
    };
}

type ClipboardState = ReturnType<typeof useClipboardState>;

function useClipboardTextures() {
    const portlandRoseTexture = Gdk.Texture.newFromResource(portlandRosePath);
    const floppyBuddyTexture = Gdk.Texture.newFromResource(floppyBuddyPath);
    const demo4LogoTexture = Gdk.Texture.newFromResource(demo4LogoPath);
    return { portlandRoseTexture, floppyBuddyTexture, demo4LogoTexture };
}

const getClipboard = () => Gdk.Display.getDefault()?.getClipboard() ?? null;

const computeCanPaste = (formats: Gdk.ContentFormats): boolean =>
    formats.containGtype(GObject.Type.STRING) ||
    formats.containGtype(gdkRgbaType) ||
    formats.containGtype(gdkPaintableType) ||
    formats.containGtype(gfileType) ||
    formats.containMimeType("image/png");

function useDragProviders(state: ClipboardState) {
    const { sourceText, sourceColor, selectedImage, sourceFile } = state;

    const createTextDragProvider = () =>
        Gdk.ContentProvider.newForValue(GObject.buildValue(GObject.Type.STRING, (v) => v.setString(sourceText)));

    const createColorDragProvider = () =>
        Gdk.ContentProvider.newForValue(GObject.buildValue(gdkRgbaType, (v) => v.setBoxed(sourceColor)));

    const createImageDragProvider = () => {
        const path = imagePathForIndex(selectedImage);
        try {
            const texture = Gdk.Texture.newFromResource(path);
            return Gdk.ContentProvider.newForValue(GObject.buildValue(gdkPaintableType, (v) => v.setObject(texture)));
        } catch (e) {
            if (e instanceof Error) console.error(e.message);
            return null;
        }
    };

    const createFileDragProvider = () => {
        if (!sourceFile) return null;
        return Gdk.ContentProvider.newForValue(GObject.buildValue(gfileType, (v) => v.setObject(sourceFile)));
    };

    return { createTextDragProvider, createColorDragProvider, createImageDragProvider, createFileDragProvider };
}

const imagePathForIndex = (index: number) => {
    const paths = [portlandRosePath, floppyBuddyPath, demo4LogoPath];
    return paths[index] ?? portlandRosePath;
};

const copyTextToClipboard = (clipboard: Gdk.Clipboard, sourceText: string) =>
    setClipboardValue(
        clipboard,
        GObject.buildValue(GObject.Type.STRING, (v) => v.setString(sourceText)),
    );

const copyColorToClipboard = (clipboard: Gdk.Clipboard, sourceColor: Gdk.RGBA) =>
    setClipboardValue(
        clipboard,
        GObject.buildValue(gdkRgbaType, (v) => v.setBoxed(sourceColor)),
    );

const copyImageToClipboard = (clipboard: Gdk.Clipboard, selectedImage: number) => {
    const path = imagePathForIndex(selectedImage);
    try {
        const texture = Gdk.Texture.newFromResource(path);
        setClipboardValue(
            clipboard,
            GObject.buildValue(gdkPaintableType, (v) => v.setObject(texture)),
        );
    } catch (e) {
        if (e instanceof Error) console.error(e.message);
    }
};

const copyFileToClipboard = (clipboard: Gdk.Clipboard, sourceFile: Gio.File) =>
    setClipboardValue(
        clipboard,
        GObject.buildValue(gfileType, (v) => v.setObject(sourceFile)),
    );

function useClipboardHandlers(state: ClipboardState, window: React.RefObject<Gtk.Window | null>) {
    const { sourceType, sourceText, sourceColor, selectedImage, sourceFile, setSourceFile, setPastedContent } = state;

    const handleCopy = () => {
        const clipboard = getClipboard();
        if (!clipboard) return;
        if (sourceType === "Text") copyTextToClipboard(clipboard, sourceText);
        else if (sourceType === "Color") copyColorToClipboard(clipboard, sourceColor);
        else if (sourceType === "Image") copyImageToClipboard(clipboard, selectedImage);
        else if ((sourceType === "File" || sourceType === "Folder") && sourceFile)
            copyFileToClipboard(clipboard, sourceFile);
    };

    const handlePaste = async () => {
        const clipboard = getClipboard();
        if (!clipboard) return;
        const formats = clipboard.getFormats();
        try {
            if (await tryPasteTexture(clipboard, formats, setPastedContent)) return;
            if (await tryPastePaintable(clipboard, formats, setPastedContent)) return;
            if (await tryPasteColor(clipboard, formats, setPastedContent)) return;
            if (await tryPasteFile(clipboard, formats, setPastedContent)) return;
            await tryPasteText(clipboard, formats, setPastedContent);
        } catch (e) {
            if (e instanceof Error) console.error(e.message);
        }
    };

    const handleFileSelect = () => openFileDialog(window.current, "file", setSourceFile);

    const handleFolderSelect = () => openFileDialog(window.current, "folder", setSourceFile);

    const handleDrop = (value: GObject.Value) => handleClipboardDrop(value, setPastedContent);

    return { handleCopy, handlePaste, handleFileSelect, handleFolderSelect, handleDrop };
}

type SetPastedContent = React.Dispatch<React.SetStateAction<PastedContent>>;

const tryPasteTexture = async (
    clipboard: Gdk.Clipboard,
    formats: Gdk.ContentFormats,
    setPastedContent: SetPastedContent,
): Promise<boolean> => {
    if (!formats.containMimeType("image/png")) return false;
    const texture = await readTextureAsync(clipboard);
    if (!texture) return false;
    setPastedContent({ type: "Image", paintable: texture });
    return true;
};

const tryPastePaintable = async (
    clipboard: Gdk.Clipboard,
    formats: Gdk.ContentFormats,
    setPastedContent: SetPastedContent,
): Promise<boolean> => {
    if (!formats.containGtype(gdkPaintableType)) return false;
    const value = await readValueAsync(clipboard, gdkPaintableType);
    const obj = value.getObject();
    if (!obj) return false;
    setPastedContent({ type: "Image", paintable: obj as Gdk.Paintable });
    return true;
};

const tryPasteColor = async (
    clipboard: Gdk.Clipboard,
    formats: Gdk.ContentFormats,
    setPastedContent: SetPastedContent,
): Promise<boolean> => {
    if (!formats.containGtype(gdkRgbaType)) return false;
    const value = await readValueAsync(clipboard, gdkRgbaType);
    const rgba = value.getBoxed<Gdk.RGBA>();
    if (!rgba) return false;
    setPastedContent({ type: "Color", color: buildRgba(rgba.red, rgba.green, rgba.blue, rgba.alpha) });
    return true;
};

const tryPasteFile = async (
    clipboard: Gdk.Clipboard,
    formats: Gdk.ContentFormats,
    setPastedContent: SetPastedContent,
): Promise<boolean> => {
    if (!formats.containGtype(gfileType)) return false;
    const value = await readValueAsync(clipboard, gfileType);
    const obj = value.getObject();
    if (!(obj instanceof Gio.File)) return false;
    setPastedContent({ type: "File", filePath: obj.getPath() ?? obj.getUri() ?? undefined });
    return true;
};

const tryPasteText = async (
    clipboard: Gdk.Clipboard,
    formats: Gdk.ContentFormats,
    setPastedContent: SetPastedContent,
): Promise<boolean> => {
    if (!formats.containGtype(GObject.Type.STRING)) return false;
    const text = await clipboard.readTextAsync(null);
    if (text === null) return false;
    setPastedContent({ type: "Text", text });
    return true;
};

const openFileDialog = async (
    window: Gtk.Window | null,
    kind: "file" | "folder",
    setSourceFile: (f: Gio.File) => void,
) => {
    const dialog = new Gtk.FileDialog();
    try {
        const file = kind === "file" ? await dialog.open(window, null) : await dialog.selectFolder(window, null);
        setSourceFile(file);
    } catch (e) {
        if (e instanceof Error) console.error(e.message);
    }
};

const handleClipboardDrop = (value: GObject.Value, setPastedContent: SetPastedContent): boolean => {
    if (GObject.typeCheckValueHolds(value, GObject.Type.OBJECT)) {
        const obj = value.getObject();
        if (obj) {
            if (GObject.typeIsA(obj.__gtype__, gdkPaintableType)) {
                setPastedContent({ type: "Image", paintable: obj as Gdk.Paintable });
                return true;
            }
            if (obj instanceof Gio.File) {
                setPastedContent({ type: "File", filePath: obj.getPath() ?? obj.getUri() ?? undefined });
                return true;
            }
        }
    }
    if (GObject.typeCheckValueHolds(value, gdkRgbaType)) {
        const rgba = value.getBoxed<Gdk.RGBA>();
        if (rgba) {
            setPastedContent({ type: "Color", color: buildRgba(rgba.red, rgba.green, rgba.blue, rgba.alpha) });
            return true;
        }
    }
    if (GObject.typeCheckValueHolds(value, GObject.Type.STRING)) {
        const text = value.getString();
        if (text) {
            setPastedContent({ type: "Text", text });
            return true;
        }
    }
    return false;
};

interface ClipboardSourceSectionProps {
    state: ClipboardState;
    textures: ReturnType<typeof useClipboardTextures>;
    providers: ReturnType<typeof useDragProviders>;
    onCopy: () => void;
    onFileSelect: () => void;
    onFolderSelect: () => void;
}

const ClipboardSourceSection = ({
    state,
    textures,
    providers,
    onCopy,
    onFileSelect,
    onFolderSelect,
}: ClipboardSourceSectionProps) => (
    <GtkBox spacing={12}>
        <GtkDropDown
            name="source-type"
            accessibleLabel="Source Type"
            valign={Gtk.Align.CENTER}
            onSelectionChanged={(id) => state.setSourceType(id as SourceType)}
            items={SOURCE_TYPES.map((type) => ({ id: type, value: type }))}
        />
        <GtkStack name="source-stack" page={state.sourceType} vexpand>
            <SourcePageText state={state} createTextDragProvider={providers.createTextDragProvider} />
            <SourcePageColor state={state} createColorDragProvider={providers.createColorDragProvider} />
            <SourcePageImage
                state={state}
                textures={textures}
                createImageDragProvider={providers.createImageDragProvider}
            />
            <SourcePageFile
                id="File"
                label="File Drag Source"
                state={state}
                onClick={onFileSelect}
                createFileDragProvider={providers.createFileDragProvider}
            />
            <SourcePageFile
                id="Folder"
                label="Folder Drag Source"
                state={state}
                onClick={onFolderSelect}
                createFileDragProvider={providers.createFileDragProvider}
            />
        </GtkStack>
        <GtkButton label="_Copy" useUnderline valign={Gtk.Align.CENTER} sensitive={state.canCopy} onClicked={onCopy} />
    </GtkBox>
);

const SourcePageText = ({
    state,
    createTextDragProvider,
}: {
    state: ClipboardState;
    createTextDragProvider: () => Gdk.ContentProvider;
}) => (
    <GtkStackPage id="Text">
        <GtkEntry
            name="source-entry"
            text={state.sourceText}
            valign={Gtk.Align.CENTER}
            accessibleLabel="Text Drag Source"
            onChanged={(entry) => state.setSourceText(entry.getText())}
            addController={<GtkDragSource onPrepare={createTextDragProvider} actions={Gdk.DragAction.COPY} />}
        />
    </GtkStackPage>
);

const SourcePageColor = ({
    state,
    createColorDragProvider,
}: {
    state: ClipboardState;
    createColorDragProvider: () => Gdk.ContentProvider;
}) => (
    <GtkStackPage id="Color">
        <GtkColorDialogButton
            name="color-button"
            rgba={state.sourceColor}
            valign={Gtk.Align.CENTER}
            accessibleLabel="Color Drag Source"
            onRgbaChanged={(rgba) => state.setSourceColor(buildRgba(rgba.red, rgba.green, rgba.blue, rgba.alpha))}
            addController={<GtkDragSource onPrepare={createColorDragProvider} actions={Gdk.DragAction.COPY} />}
        />
    </GtkStackPage>
);

interface SourcePageImageProps {
    state: ClipboardState;
    textures: ReturnType<typeof useClipboardTextures>;
    createImageDragProvider: () => Gdk.ContentProvider | null;
}

const SourcePageImage = ({ state, textures, createImageDragProvider }: SourcePageImageProps) => (
    <GtkStackPage id="Image">
        <GtkBox valign={Gtk.Align.CENTER} cssClasses={["linked"]}>
            <ImageToggle
                name="image_rose"
                buttonLabel="Photo Drag Source"
                imageLabel="Portland Rose Photo"
                index={0}
                state={state}
                paintable={textures.portlandRoseTexture}
            />
            <ImageToggle
                name="image_floppy"
                buttonLabel="Icon Drag Source"
                imageLabel="Floppy Buddy Icon"
                index={1}
                state={state}
                paintable={textures.floppyBuddyTexture}
                createProvider={createImageDragProvider}
            />
            <ImageToggle
                name="image_logo"
                buttonLabel="SVG Drag Source"
                imageLabel="gtk-demo logo"
                index={2}
                state={state}
                paintable={textures.demo4LogoTexture}
                createProvider={createImageDragProvider}
            />
        </GtkBox>
    </GtkStackPage>
);

interface ImageToggleProps {
    name: string;
    buttonLabel: string;
    imageLabel: string;
    index: number;
    state: ClipboardState;
    paintable: Gdk.Texture;
    createProvider?: () => Gdk.ContentProvider | null;
}

const ImageToggle = ({ name, buttonLabel, imageLabel, index, state, paintable, createProvider }: ImageToggleProps) => (
    <GtkToggleButton
        name={name}
        accessibleLabel={buttonLabel}
        active={state.selectedImage === index}
        onToggled={(btn) => {
            if (btn.getActive()) state.setSelectedImage(index);
        }}
        addController={
            createProvider ? <GtkDragSource onPrepare={createProvider} actions={Gdk.DragAction.COPY} /> : null
        }
    >
        <GtkImage accessibleLabel={imageLabel} paintable={paintable} cssClasses={["large-icons"]} />
    </GtkToggleButton>
);

interface SourcePageFileProps {
    id: "File" | "Folder";
    label: string;
    state: ClipboardState;
    onClick: () => void;
    createFileDragProvider: () => Gdk.ContentProvider | null;
}

const SourcePageFile = ({ id, label, state, onClick, createFileDragProvider }: SourcePageFileProps) => (
    <GtkStackPage id={id}>
        <GtkButton
            valign={Gtk.Align.CENTER}
            accessibleLabel={label}
            onClicked={() => void onClick()}
            addController={
                <GtkDragSource
                    onPrepare={createFileDragProvider}
                    actions={Gdk.DragAction.COPY}
                    propagationPhase={Gtk.PropagationPhase.CAPTURE}
                />
            }
        >
            <GtkLabel label={state.sourceFile ? (state.sourceFile.getPath() ?? "—") : "—"} xalign={0} ellipsize={1} />
        </GtkButton>
    </GtkStackPage>
);

interface ClipboardPasteSectionProps {
    pastedContent: PastedContent;
    canPaste: boolean;
    onPaste: () => Promise<void>;
    onDrop: (value: GObject.Value) => boolean;
}

const ClipboardPasteSection = ({ pastedContent, canPaste, onPaste, onDrop }: ClipboardPasteSectionProps) => (
    <GtkBox
        name="paste-box"
        spacing={12}
        addController={
            <GtkDropTarget
                types={[gdkTextureType, gdkPaintableType, gfileType, gdkRgbaType, GObject.Type.STRING]}
                actions={Gdk.DragAction.COPY}
                onDrop={onDrop}
            />
        }
    >
        <GtkButton
            label="_Paste"
            useUnderline
            valign={Gtk.Align.CENTER}
            sensitive={canPaste}
            onClicked={() => void onPaste()}
        />
        <GtkLabel name="paste-type-label" label={pastedContent.type} xalign={0} />
        <GtkStack
            name="paste-stack"
            page={pastedContent.type || "Empty"}
            halign={Gtk.Align.END}
            valign={Gtk.Align.CENTER}
        >
            <GtkStackPage id="Empty">
                <GtkLabel label="" />
            </GtkStackPage>
            <GtkStackPage id="Text">
                <GtkLabel
                    label={pastedContent.text ?? ""}
                    halign={Gtk.Align.END}
                    valign={Gtk.Align.CENTER}
                    xalign={0}
                    ellipsize={3}
                />
            </GtkStackPage>
            <GtkStackPage id="Image">
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
            </GtkStackPage>
            <GtkStackPage id="Color">
                <GtkDrawingArea
                    contentWidth={32}
                    contentHeight={32}
                    halign={Gtk.Align.END}
                    valign={Gtk.Align.CENTER}
                    render={(cr, w, h) => {
                        const c = pastedContent.color;
                        if (c) drawColorSwatch(cr, w, h, c);
                    }}
                />
            </GtkStackPage>
            <GtkStackPage id="File">
                <GtkLabel
                    label={pastedContent.filePath ?? ""}
                    halign={Gtk.Align.END}
                    valign={Gtk.Align.CENTER}
                    xalign={0}
                    hexpand
                    ellipsize={1}
                />
            </GtkStackPage>
        </GtkStack>
    </GtkBox>
);

const ClipboardDemo = ({ window }: DemoProps) => {
    const state = useClipboardState();
    const textures = useClipboardTextures();
    const providers = useDragProviders(state);
    const clipboardHandlers = useClipboardHandlers(state, window);
    const formats = useProperty(getClipboard(), "formats");
    const canPaste = formats ? computeCanPaste(formats) : false;

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
                    "“Copy” will copy the selected data the clipboard, “Paste” will show the current clipboard contents. You can also drag the data to the bottom."
                }
                wrap
                maxWidthChars={40}
            />

            <ClipboardSourceSection
                state={state}
                textures={textures}
                providers={providers}
                onCopy={clipboardHandlers.handleCopy}
                onFileSelect={clipboardHandlers.handleFileSelect}
                onFolderSelect={clipboardHandlers.handleFolderSelect}
            />

            <GtkSeparator />

            <ClipboardPasteSection
                pastedContent={state.pastedContent}
                canPaste={canPaste}
                onPaste={clipboardHandlers.handlePaste}
                onDrop={clipboardHandlers.handleDrop}
            />
        </GtkBox>
    );
};

export const clipboardDemo: Demo = {
    id: "clipboard",
    title: "Clipboard",
    description:
        "GdkClipboard is used for clipboard handling. This demo shows how to copy and paste text, images, colors or files to and from the clipboard.\n\nYou can also use Drag-And-Drop to copy the data from the source to the target.",
    keywords: ["drag-and-drop", "dnd"],
    component: ClipboardDemo,
    sourceCode,
};
