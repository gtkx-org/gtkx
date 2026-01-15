import { css } from "@gtkx/css";
import * as Gdk from "@gtkx/ffi/gdk";
import * as GObject from "@gtkx/ffi/gobject";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkColorDialogButton, GtkEntry, GtkFrame, GtkImage, GtkLabel, GtkPicture } from "@gtkx/react";
import { useCallback, useEffect, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./clipboard.tsx?raw";

const previewStyle = css`
    background-color: alpha(@window_fg_color, 0.05);
    border-radius: 8px;
    padding: 12px;
`;

const gdkRgbaType = GObject.typeFromName("GdkRGBA");

const ClipboardDemo = () => {
    const [textToCopy, setTextToCopy] = useState("Hello from clipboard!");
    const [pastedText, setPastedText] = useState<string | null>(null);
    const [copyStatus, setCopyStatus] = useState<string | null>(null);
    const [clipboardHasText, setClipboardHasText] = useState(false);
    const [clipboardHasImage, setClipboardHasImage] = useState(false);
    const [clipboardHasColor, setClipboardHasColor] = useState(false);
    const [pastedTexture, setPastedTexture] = useState<Gdk.Texture | null>(null);
    const [selectedColor, setSelectedColor] = useState<Gdk.RGBA>(new Gdk.RGBA({ red: 0.2, green: 0.6, blue: 0.9, alpha: 1.0 }));
    const [pastedColor, setPastedColor] = useState<Gdk.RGBA | null>(null);

    const getClipboard = useCallback(() => {
        const display = Gdk.Display.getDefault();
        return display?.getClipboard() ?? null;
    }, []);

    const checkClipboardContents = useCallback(() => {
        const clipboard = getClipboard();
        if (!clipboard) return;

        const formats = clipboard.getFormats();
        setClipboardHasText(formats.containGtype(GObject.Type.STRING));
        setClipboardHasImage(formats.containMimeType("image/png") || formats.containMimeType("image/jpeg"));
        setClipboardHasColor(formats.containGtype(gdkRgbaType));
    }, [getClipboard]);

    useEffect(() => {
        const clipboard = getClipboard();
        if (!clipboard) return;

        checkClipboardContents();
        clipboard.connect("changed", () => {
            checkClipboardContents();
        });
    }, [getClipboard, checkClipboardContents]);

    const handleCopyText = useCallback(() => {
        const clipboard = getClipboard();
        if (!clipboard) return;

        const value = GObject.Value.newFromString(textToCopy);
        clipboard.setValue(value);
        setCopyStatus("Text copied!");
        setTimeout(() => setCopyStatus(null), 2000);
    }, [textToCopy, getClipboard]);

    const handlePasteText = useCallback(async () => {
        const clipboard = getClipboard();
        if (!clipboard) return;

        try {
            const text = await clipboard.readTextAsync();
            setPastedText(text);
        } catch {
            setPastedText("[Failed to read clipboard]");
        }
    }, [getClipboard]);

    const handlePasteImage = useCallback(async () => {
        const clipboard = getClipboard();
        if (!clipboard) return;

        try {
            const texture = await clipboard.readTextureAsync();
            setPastedTexture(texture);
        } catch {
            setPastedTexture(null);
        }
    }, [getClipboard]);

    const handleCopyColor = useCallback(() => {
        const clipboard = getClipboard();
        if (!clipboard) return;

        const value = GObject.Value.newFromBoxed(selectedColor);
        clipboard.setValue(value);
        setCopyStatus(`Color copied: ${selectedColor.toString()}`);
        setTimeout(() => setCopyStatus(null), 2000);
    }, [selectedColor, getClipboard]);

    const handlePasteColor = useCallback(async () => {
        const clipboard = getClipboard();
        if (!clipboard) return;

        try {
            const value = await clipboard.readValueAsync(gdkRgbaType, 0);
            const boxedPtr = value.getBoxed();
            if (boxedPtr !== null) {
                const rgba = new Gdk.RGBA({});
                rgba.handle = boxedPtr as unknown as typeof rgba.handle;
                setPastedColor(new Gdk.RGBA({ red: rgba.red, green: rgba.green, blue: rgba.blue, alpha: rgba.alpha }));
            }
        } catch {
            setPastedColor(null);
        }
    }, [getClipboard]);

    const handleClearClipboard = useCallback(() => {
        const clipboard = getClipboard();
        if (!clipboard) return;

        clipboard.setContent(null);
        setCopyStatus("Clipboard cleared!");
        setTimeout(() => setCopyStatus(null), 2000);
    }, [getClipboard]);

    const handleColorChanged = useCallback((button: Gtk.ColorDialogButton) => {
        const rgba = button.getRgba();
        if (rgba) {
            setSelectedColor(new Gdk.RGBA({ red: rgba.red, green: rgba.green, blue: rgba.blue, alpha: rgba.alpha }));
        }
    }, []);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={24} marginStart={20} marginEnd={20} marginTop={20}>
            <GtkLabel label="Clipboard" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="GTK provides clipboard access through GdkClipboard. Copy text, colors, or images to the system clipboard and paste them back."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            {copyStatus && <GtkLabel label={copyStatus} cssClasses={["success"]} halign={Gtk.Align.START} />}

            <GtkFrame label="Text Clipboard">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="Copy and paste text programmatically using clipboard.setValue() and clipboard.readTextAsync()."
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />

                    <GtkBox spacing={12}>
                        <GtkEntry
                            text={textToCopy}
                            onChanged={(entry) => setTextToCopy(entry.getText())}
                            hexpand
                            placeholderText="Text to copy..."
                        />
                        <GtkButton onClicked={handleCopyText}>
                            <GtkBox spacing={6}>
                                <GtkImage iconName="edit-copy-symbolic" />
                                <GtkLabel label="Copy" />
                            </GtkBox>
                        </GtkButton>
                    </GtkBox>

                    <GtkBox spacing={12}>
                        <GtkButton onClicked={() => void handlePasteText()} sensitive={clipboardHasText}>
                            <GtkBox spacing={6}>
                                <GtkImage iconName="edit-paste-symbolic" />
                                <GtkLabel label="Paste Text" />
                            </GtkBox>
                        </GtkButton>
                        {pastedText && (
                            <GtkLabel
                                label={`Pasted: "${pastedText}"`}
                                cssClasses={["dim-label"]}
                                ellipsize={3}
                                hexpand
                            />
                        )}
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Color Clipboard">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="Colors can be copied to the clipboard as GdkRGBA values using GObject.Value.newFromBoxed()."
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />

                    <GtkBox spacing={12} valign={Gtk.Align.CENTER}>
                        <GtkLabel label="Select color:" />
                        <GtkColorDialogButton
                            dialog={new Gtk.ColorDialog()}
                            rgba={selectedColor}
                            onNotify={(self, pspec) => {
                                if (pspec === "rgba") {
                                    handleColorChanged(self as Gtk.ColorDialogButton);
                                }
                            }}
                        />
                        <GtkButton onClicked={handleCopyColor}>
                            <GtkBox spacing={6}>
                                <GtkImage iconName="edit-copy-symbolic" />
                                <GtkLabel label="Copy Color" />
                            </GtkBox>
                        </GtkButton>
                    </GtkBox>

                    <GtkBox spacing={12} valign={Gtk.Align.CENTER}>
                        <GtkButton onClicked={() => void handlePasteColor()} sensitive={clipboardHasColor}>
                            <GtkBox spacing={6}>
                                <GtkImage iconName="edit-paste-symbolic" />
                                <GtkLabel label="Paste Color" />
                            </GtkBox>
                        </GtkButton>
                        {pastedColor && (
                            <GtkBox spacing={8} valign={Gtk.Align.CENTER}>
                                <GtkLabel label={`Pasted: ${pastedColor.toString()}`} cssClasses={["dim-label"]} />
                            </GtkBox>
                        )}
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Image Clipboard">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="Images can be read from the clipboard as GdkTexture. Copy an image from another application and paste it here."
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />

                    <GtkBox spacing={12}>
                        <GtkButton onClicked={() => void handlePasteImage()} sensitive={clipboardHasImage}>
                            <GtkBox spacing={6}>
                                <GtkImage iconName="edit-paste-symbolic" />
                                <GtkLabel label="Paste Image" />
                            </GtkBox>
                        </GtkButton>
                        <GtkLabel
                            label={clipboardHasImage ? "Image available in clipboard" : "No image in clipboard"}
                            cssClasses={["dim-label"]}
                        />
                    </GtkBox>

                    {pastedTexture && (
                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8} cssClasses={[previewStyle]}>
                            <GtkLabel label="Pasted image:" halign={Gtk.Align.START} cssClasses={["heading"]} />
                            <GtkPicture
                                paintable={pastedTexture}
                                contentFit={Gtk.ContentFit.SCALE_DOWN}
                                widthRequest={200}
                                heightRequest={150}
                            />
                            <GtkLabel
                                label={`Size: ${pastedTexture.getWidth()}×${pastedTexture.getHeight()}`}
                                cssClasses={["dim-label", "caption"]}
                            />
                        </GtkBox>
                    )}
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Clipboard Status">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="The clipboard emits a 'changed' signal when its contents change. This demo monitors the clipboard and updates the UI accordingly."
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />

                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6}>
                        <GtkBox spacing={12}>
                            <GtkImage
                                iconName={clipboardHasText ? "emblem-ok-symbolic" : "window-close-symbolic"}
                                cssClasses={clipboardHasText ? ["success"] : ["dim-label"]}
                            />
                            <GtkLabel label="Text content" />
                        </GtkBox>
                        <GtkBox spacing={12}>
                            <GtkImage
                                iconName={clipboardHasColor ? "emblem-ok-symbolic" : "window-close-symbolic"}
                                cssClasses={clipboardHasColor ? ["success"] : ["dim-label"]}
                            />
                            <GtkLabel label="Color content (GdkRGBA)" />
                        </GtkBox>
                        <GtkBox spacing={12}>
                            <GtkImage
                                iconName={clipboardHasImage ? "emblem-ok-symbolic" : "window-close-symbolic"}
                                cssClasses={clipboardHasImage ? ["success"] : ["dim-label"]}
                            />
                            <GtkLabel label="Image content" />
                        </GtkBox>
                    </GtkBox>

                    <GtkButton
                        onClicked={handleClearClipboard}
                        cssClasses={["destructive-action"]}
                        halign={Gtk.Align.START}
                    >
                        <GtkBox spacing={6}>
                            <GtkImage iconName="edit-clear-symbolic" />
                            <GtkLabel label="Clear Clipboard" />
                        </GtkBox>
                    </GtkButton>
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Built-in Widget Support">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="Text widgets have built-in clipboard support. Select text and use standard shortcuts."
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />

                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                        <GtkEntry placeholderText="Type here, select text, and use Ctrl+C to copy..." />
                        <GtkEntry placeholderText="Use Ctrl+V to paste here..." />
                    </GtkBox>

                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={4}>
                        <GtkBox spacing={12}>
                            <GtkLabel label="Ctrl+C" widthChars={10} xalign={0} cssClasses={["monospace"]} />
                            <GtkLabel label="Copy selected text" cssClasses={["dim-label"]} />
                        </GtkBox>
                        <GtkBox spacing={12}>
                            <GtkLabel label="Ctrl+X" widthChars={10} xalign={0} cssClasses={["monospace"]} />
                            <GtkLabel label="Cut selected text" cssClasses={["dim-label"]} />
                        </GtkBox>
                        <GtkBox spacing={12}>
                            <GtkLabel label="Ctrl+V" widthChars={10} xalign={0} cssClasses={["monospace"]} />
                            <GtkLabel label="Paste from clipboard" cssClasses={["dim-label"]} />
                        </GtkBox>
                    </GtkBox>
                </GtkBox>
            </GtkFrame>
        </GtkBox>
    );
};

export const clipboardDemo: Demo = {
    id: "clipboard",
    title: "Clipboard",
    description: "Copy and paste text, colors, and images with GdkClipboard",
    keywords: ["clipboard", "copy", "paste", "cut", "GdkClipboard", "ContentProvider", "text", "image", "color", "GdkRGBA", "transfer"],
    component: ClipboardDemo,
    sourceCode,
};
