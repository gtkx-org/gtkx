import type { Context } from "@gtkx/ffi/cairo";
import * as Gdk from "@gtkx/ffi/gdk";
import * as Gio from "@gtkx/ffi/gio";
import type { GType } from "@gtkx/ffi/gobject";
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
} from "@gtkx/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { makeValue } from "../../gvalue.js";
import type { Demo, DemoProps } from "../types.js";
import sourceCode from "./clipboard.tsx?raw";
import floppyBuddyPath from "./floppybuddy.gif";
import demo4SymbolicPath from "./org.gtk.Demo4-symbolic.svg";
import portlandRosePath from "./portland-rose.jpg";

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

let gdkRgbaTypeCache: GType | null = null;
const getGdkRgbaType = (): GType => {
    gdkRgbaTypeCache ??= GObject.typeFromName("GdkRGBA");
    return gdkRgbaTypeCache;
};

let gdkPaintableTypeCache: GType | null = null;
const getGdkPaintableType = (): GType => {
    gdkPaintableTypeCache ??= GObject.typeFromName("GdkPaintable");
    return gdkPaintableTypeCache;
};

let gFileTypeCache: GType | null = null;
const getGFileType = (): GType => {
    gFileTypeCache ??= GObject.typeFromName("GFile");
    return gFileTypeCache;
};

let gdkTextureTypeCache: GType | null = null;
const getGdkTextureType = (): GType => {
    gdkTextureTypeCache ??= GObject.typeFromName("GdkTexture");
    return gdkTextureTypeCache;
};

const SOURCE_TYPES: SourceType[] = ["Text", "Color", "Image", "File", "Folder"];

function drawColorSwatch(cr: Context, width: number, height: number, rgba: Gdk.RGBA): void {
    cr.setSourceRgba(rgba.red, rgba.green, rgba.blue, rgba.alpha);
    cr.rectangle(0, 0, width, height);
    cr.fill();
}

const makeRgba = (red: number, green: number, blue: number, alpha: number): Gdk.RGBA => {
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
    const [sourceColor, setSourceColor] = useState<Gdk.RGBA>(makeRgba(128 / 255, 0, 128 / 255, 1));
    const [selectedImage, setSelectedImage] = useState(0);
    const [sourceFile, setSourceFile] = useState<Gio.File | null>(null);
    const [pastedContent, setPastedContent] = useState<PastedContent>({ type: "" });
    const [canPaste, setCanPaste] = useState(false);
    const [canCopy, setCanCopy] = useState(true);

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
        canPaste,
        setCanPaste,
        canCopy,
        setCanCopy,
    };
}

type ClipboardState = ReturnType<typeof useClipboardState>;

function useClipboardTextures() {
    const portlandRoseTexture = useMemo(() => Gdk.Texture.newFromFilename(portlandRosePath), []);
    const floppyBuddyTexture = useMemo(() => Gdk.Texture.newFromFilename(floppyBuddyPath), []);
    const demo4SymbolicTexture = useMemo(() => Gdk.Texture.newFromFilename(demo4SymbolicPath), []);
    return { portlandRoseTexture, floppyBuddyTexture, demo4SymbolicTexture };
}

const getClipboard = () => Gdk.Display.getDefault()?.getClipboard() ?? null;

const computeCanPaste = (formats: Gdk.ContentFormats): boolean =>
    formats.containGtype(GObject.Type.STRING) ||
    formats.containGtype(getGdkRgbaType()) ||
    formats.containGtype(getGdkPaintableType()) ||
    formats.containGtype(getGFileType()) ||
    formats.containMimeType("image/png");

function useClipboardChangedListener(setCanPaste: (canPaste: boolean) => void) {
    useEffect(() => {
        const clipboard = getClipboard();
        if (!clipboard) return;
        const update = () => setCanPaste(computeCanPaste(clipboard.getFormats()));
        update();
        clipboard.connect("changed", update);
    }, [setCanPaste]);
}

function useCanCopyEffect(state: ClipboardState) {
    const { sourceType, sourceText, sourceFile, setCanCopy } = state;
    useEffect(() => {
        if (sourceType === "Text") setCanCopy(sourceText.length > 0);
        else if (sourceType === "File" || sourceType === "Folder") setCanCopy(sourceFile !== null);
        else setCanCopy(true);
    }, [sourceType, sourceText, sourceFile, setCanCopy]);
}

function useDragProviders(state: ClipboardState) {
    const { sourceText, sourceColor, selectedImage, sourceFile } = state;

    const createTextDragProvider = useCallback(
        () => Gdk.ContentProvider.newForValue(makeValue(GObject.Type.STRING, (v) => v.setString(sourceText))),
        [sourceText],
    );

    const createColorDragProvider = useCallback(
        () => Gdk.ContentProvider.newForValue(makeValue(getGdkRgbaType(), (v) => v.setBoxed(sourceColor))),
        [sourceColor],
    );

    const createImageDragProvider = useCallback(() => {
        const path = imagePathForIndex(selectedImage);
        try {
            const texture = Gdk.Texture.newFromFilename(path);
            return Gdk.ContentProvider.newForValue(makeValue(getGdkPaintableType(), (v) => v.setObject(texture)));
        } catch (e) {
            if (e instanceof Error) console.error(e.message);
            return null;
        }
    }, [selectedImage]);

    const createFileDragProvider = useCallback(() => {
        if (!sourceFile) return null;
        return Gdk.ContentProvider.newForValue(makeValue(getGFileType(), (v) => v.setObject(sourceFile)));
    }, [sourceFile]);

    return { createTextDragProvider, createColorDragProvider, createImageDragProvider, createFileDragProvider };
}

const imagePathForIndex = (index: number) => {
    const paths = [portlandRosePath, floppyBuddyPath, demo4SymbolicPath];
    return paths[index] ?? portlandRosePath;
};

const copyTextToClipboard = (clipboard: Gdk.Clipboard, sourceText: string) =>
    setClipboardValue(
        clipboard,
        makeValue(GObject.Type.STRING, (v) => v.setString(sourceText)),
    );

const copyColorToClipboard = (clipboard: Gdk.Clipboard, sourceColor: Gdk.RGBA) =>
    setClipboardValue(
        clipboard,
        makeValue(getGdkRgbaType(), (v) => v.setBoxed(sourceColor)),
    );

const copyImageToClipboard = (clipboard: Gdk.Clipboard, selectedImage: number) => {
    const path = imagePathForIndex(selectedImage);
    try {
        const texture = Gdk.Texture.newFromFilename(path);
        setClipboardValue(
            clipboard,
            makeValue(getGdkPaintableType(), (v) => v.setObject(texture)),
        );
    } catch (e) {
        if (e instanceof Error) console.error(e.message);
    }
};

const copyFileToClipboard = (clipboard: Gdk.Clipboard, sourceFile: Gio.File) =>
    setClipboardValue(
        clipboard,
        makeValue(getGFileType(), (v) => v.setObject(sourceFile)),
    );

function useClipboardHandlers(state: ClipboardState, window: React.RefObject<Gtk.Window | null>) {
    const { sourceType, sourceText, sourceColor, selectedImage, sourceFile, setSourceFile, setPastedContent } = state;

    const handleCopy = useCallback(() => {
        const clipboard = getClipboard();
        if (!clipboard) return;
        if (sourceType === "Text") copyTextToClipboard(clipboard, sourceText);
        else if (sourceType === "Color") copyColorToClipboard(clipboard, sourceColor);
        else if (sourceType === "Image") copyImageToClipboard(clipboard, selectedImage);
        else if ((sourceType === "File" || sourceType === "Folder") && sourceFile)
            copyFileToClipboard(clipboard, sourceFile);
    }, [sourceType, sourceText, sourceColor, selectedImage, sourceFile]);

    const handlePaste = useCallback(async () => {
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
    }, [setPastedContent]);

    const handleFileSelect = useCallback(
        () => openFileDialog(window.current, "file", setSourceFile),
        [window, setSourceFile],
    );

    const handleFolderSelect = useCallback(
        () => openFileDialog(window.current, "folder", setSourceFile),
        [window, setSourceFile],
    );

    const handleDrop = useCallback(
        (value: GObject.Value) => handleClipboardDrop(value, setPastedContent),
        [setPastedContent],
    );

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
    if (!formats.containGtype(getGdkPaintableType())) return false;
    const value = await readValueAsync(clipboard, getGdkPaintableType());
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
    if (!formats.containGtype(getGdkRgbaType())) return false;
    const value = await readValueAsync(clipboard, getGdkRgbaType());
    const rgba = value.getBoxed<Gdk.RGBA>();
    if (!rgba) return false;
    setPastedContent({ type: "Color", color: makeRgba(rgba.red, rgba.green, rgba.blue, rgba.alpha) });
    return true;
};

const tryPasteFile = async (
    clipboard: Gdk.Clipboard,
    formats: Gdk.ContentFormats,
    setPastedContent: SetPastedContent,
): Promise<boolean> => {
    if (!formats.containGtype(getGFileType())) return false;
    const value = await readValueAsync(clipboard, getGFileType());
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
    const obj = value.getObject();
    if (obj) {
        if (GObject.typeIsA(obj.__gtype__, getGdkPaintableType())) {
            setPastedContent({ type: "Image", paintable: obj as Gdk.Paintable });
            return true;
        }
        if (obj instanceof Gio.File) {
            setPastedContent({ type: "File", filePath: obj.getPath() ?? obj.getUri() ?? undefined });
            return true;
        }
    }
    const rgba = value.getBoxed<Gdk.RGBA>();
    if (rgba) {
        setPastedContent({ type: "Color", color: makeRgba(rgba.red, rgba.green, rgba.blue, rgba.alpha) });
        return true;
    }
    const text = value.getString();
    if (text) {
        setPastedContent({ type: "Text", text });
        return true;
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
    <GtkStack.Page id="Text">
        <GtkEntry
            name="source-entry"
            text={state.sourceText}
            valign={Gtk.Align.CENTER}
            accessibleLabel="Text Drag Source"
            onChanged={(entry) => state.setSourceText(entry.getText())}
        >
            <GtkDragSource onPrepare={createTextDragProvider} actions={Gdk.DragAction.COPY} />
        </GtkEntry>
    </GtkStack.Page>
);

const SourcePageColor = ({
    state,
    createColorDragProvider,
}: {
    state: ClipboardState;
    createColorDragProvider: () => Gdk.ContentProvider;
}) => (
    <GtkStack.Page id="Color">
        <GtkColorDialogButton
            name="color-button"
            rgba={state.sourceColor}
            valign={Gtk.Align.CENTER}
            accessibleLabel="Color Drag Source"
            onRgbaChanged={(rgba) => state.setSourceColor(makeRgba(rgba.red, rgba.green, rgba.blue, rgba.alpha))}
        >
            <GtkDragSource onPrepare={createColorDragProvider} actions={Gdk.DragAction.COPY} />
        </GtkColorDialogButton>
    </GtkStack.Page>
);

interface SourcePageImageProps {
    state: ClipboardState;
    textures: ReturnType<typeof useClipboardTextures>;
    createImageDragProvider: () => Gdk.ContentProvider | null;
}

const SourcePageImage = ({ state, textures, createImageDragProvider }: SourcePageImageProps) => (
    <GtkStack.Page id="Image">
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
                paintable={textures.demo4SymbolicTexture}
                createProvider={createImageDragProvider}
            />
        </GtkBox>
    </GtkStack.Page>
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
    >
        <GtkImage accessibleLabel={imageLabel} paintable={paintable} cssClasses={["large-icons"]} />
        {createProvider ? <GtkDragSource onPrepare={createProvider} actions={Gdk.DragAction.COPY} /> : null}
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
    <GtkStack.Page id={id}>
        <GtkButton valign={Gtk.Align.CENTER} accessibleLabel={label} onClicked={() => void onClick()}>
            <GtkLabel label={state.sourceFile ? (state.sourceFile.getPath() ?? "—") : "—"} xalign={0} ellipsize={1} />
            <GtkDragSource
                onPrepare={createFileDragProvider}
                actions={Gdk.DragAction.COPY}
                propagationPhase={Gtk.PropagationPhase.CAPTURE}
            />
        </GtkButton>
    </GtkStack.Page>
);

interface ClipboardPasteSectionProps {
    pastedContent: PastedContent;
    canPaste: boolean;
    onPaste: () => Promise<void>;
    onDrop: (value: GObject.Value) => boolean;
}

const ClipboardPasteSection = ({ pastedContent, canPaste, onPaste, onDrop }: ClipboardPasteSectionProps) => (
    <GtkBox name="paste-box" spacing={12}>
        <GtkDropTarget
            types={[getGdkTextureType(), getGdkPaintableType(), getGFileType(), getGdkRgbaType(), GObject.Type.STRING]}
            actions={Gdk.DragAction.COPY}
            onDrop={onDrop}
        />
        <GtkButton
            label="_Paste"
            useUnderline
            valign={Gtk.Align.CENTER}
            sensitive={canPaste}
            onClicked={() => void onPaste()}
        />
        <GtkLabel label={pastedContent.type} xalign={0} />
        <GtkStack page={pastedContent.type || "Empty"} halign={Gtk.Align.END} valign={Gtk.Align.CENTER}>
            <GtkStack.Page id="Empty">
                <GtkLabel label="" />
            </GtkStack.Page>
            <GtkStack.Page id="Text">
                <GtkLabel
                    label={pastedContent.text ?? ""}
                    halign={Gtk.Align.END}
                    valign={Gtk.Align.CENTER}
                    xalign={0}
                    ellipsize={3}
                />
            </GtkStack.Page>
            <GtkStack.Page id="Image">
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
            </GtkStack.Page>
            <GtkStack.Page id="Color">
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
            </GtkStack.Page>
            <GtkStack.Page id="File">
                <GtkLabel
                    label={pastedContent.filePath ?? ""}
                    halign={Gtk.Align.END}
                    valign={Gtk.Align.CENTER}
                    xalign={0}
                    hexpand
                    ellipsize={1}
                />
            </GtkStack.Page>
        </GtkStack>
    </GtkBox>
);

const ClipboardDemo = ({ window }: DemoProps) => {
    const state = useClipboardState();
    const textures = useClipboardTextures();
    const providers = useDragProviders(state);
    const clipboardHandlers = useClipboardHandlers(state, window);

    useClipboardChangedListener(state.setCanPaste);
    useCanCopyEffect(state);

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
                canPaste={state.canPaste}
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
