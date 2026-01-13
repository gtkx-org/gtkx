import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkEntry, GtkFrame, GtkLabel } from "@gtkx/react";
import { useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./clipboard.tsx?raw";

const ClipboardDemo = () => {
    const [_clipboardStatus, _setClipboardStatus] = useState<string | null>(null);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={24} marginStart={20} marginEnd={20} marginTop={20}>
            <GtkLabel label="Clipboard" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="GTK provides clipboard access through GdkClipboard. You can copy text, images, and other content to the system clipboard and paste from it."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkFrame label="Built-in Clipboard Support">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="Many GTK widgets have built-in clipboard support. GtkEntry and GtkTextView support Ctrl+C, Ctrl+X, and Ctrl+V by default."
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />

                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                        <GtkLabel label="Try selecting text and using Ctrl+C / Ctrl+V:" halign={Gtk.Align.START} />
                        <GtkEntry placeholderText="Type and select text, then Ctrl+C to copy..." />
                        <GtkEntry placeholderText="Press Ctrl+V to paste here..." />
                    </GtkBox>

                    <GtkLabel
                        label="Standard keyboard shortcuts:"
                        halign={Gtk.Align.START}
                        cssClasses={["heading"]}
                        marginTop={8}
                    />
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
                        <GtkBox spacing={12}>
                            <GtkLabel label="Ctrl+A" widthChars={10} xalign={0} cssClasses={["monospace"]} />
                            <GtkLabel label="Select all" cssClasses={["dim-label"]} />
                        </GtkBox>
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Clipboard API Overview">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="GdkClipboard provides programmatic access to the system clipboard:"
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />

                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6}>
                        <GtkBox spacing={12}>
                            <GtkLabel label="getClipboard()" widthChars={20} xalign={0} cssClasses={["monospace"]} />
                            <GtkLabel label="Get the clipboard from GdkDisplay" wrap cssClasses={["dim-label"]} />
                        </GtkBox>
                        <GtkBox spacing={12}>
                            <GtkLabel label="setContent()" widthChars={20} xalign={0} cssClasses={["monospace"]} />
                            <GtkLabel
                                label="Set clipboard content via ContentProvider"
                                wrap
                                cssClasses={["dim-label"]}
                            />
                        </GtkBox>
                        <GtkBox spacing={12}>
                            <GtkLabel label="readTextFinish()" widthChars={20} xalign={0} cssClasses={["monospace"]} />
                            <GtkLabel label="Read text from clipboard (async)" wrap cssClasses={["dim-label"]} />
                        </GtkBox>
                        <GtkBox spacing={12}>
                            <GtkLabel
                                label="readTextureFinish()"
                                widthChars={20}
                                xalign={0}
                                cssClasses={["monospace"]}
                            />
                            <GtkLabel label="Read image from clipboard (async)" wrap cssClasses={["dim-label"]} />
                        </GtkBox>
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="GdkContentProvider">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="Content is placed on the clipboard using GdkContentProvider, which can provide data in multiple formats:"
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />

                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6}>
                        <GtkBox spacing={12}>
                            <GtkLabel
                                label="providerNewForValue()"
                                widthChars={22}
                                xalign={0}
                                cssClasses={["monospace"]}
                            />
                            <GtkLabel label="Create provider from a GValue" wrap cssClasses={["dim-label"]} />
                        </GtkBox>
                        <GtkBox spacing={12}>
                            <GtkLabel
                                label="new ContentProvider()"
                                widthChars={22}
                                xalign={0}
                                cssClasses={["monospace"]}
                            />
                            <GtkLabel label="Create provider from raw bytes" wrap cssClasses={["dim-label"]} />
                        </GtkBox>
                        <GtkBox spacing={12}>
                            <GtkLabel
                                label="providerNewUnion()"
                                widthChars={22}
                                xalign={0}
                                cssClasses={["monospace"]}
                            />
                            <GtkLabel label="Combine multiple providers" wrap cssClasses={["dim-label"]} />
                        </GtkBox>
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Implementation Example">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="Here's how to programmatically access the clipboard:"
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />

                    <GtkLabel
                        label={`import * as Gdk from "@gtkx/ffi/gdk";
import * as GObject from "@gtkx/ffi/gobject";
import sourceCode from "./clipboard.tsx?raw";

// Get clipboard from a window
const display = window.getDisplay();
const clipboard = display.getClipboard();

// Check if clipboard is local (owned by this app)
const isLocal = clipboard.isLocal();

// Get available formats
const formats = clipboard.getFormats();

// Set text content
const value = new GObject.Value();
// ... initialize value with text ...
const provider = Gdk.ContentProvider.providerNewForValue(value);
clipboard.setContent(provider);

// Listen for clipboard changes
clipboard.connect("changed", () => {
 console.log("Clipboard content changed");
});`}
                        cssClasses={["monospace"]}
                        halign={Gtk.Align.START}
                        wrap
                    />
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Primary Selection (Linux)">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="On Linux/X11, there's a separate 'primary selection' clipboard that holds the currently selected text. It's accessed with middle-click paste."
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />

                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6}>
                        <GtkBox spacing={12}>
                            <GtkLabel label="getClipboard()" widthChars={22} xalign={0} cssClasses={["monospace"]} />
                            <GtkLabel label="Main clipboard (Ctrl+C/V)" wrap cssClasses={["dim-label"]} />
                        </GtkBox>
                        <GtkBox spacing={12}>
                            <GtkLabel
                                label="getPrimaryClipboard()"
                                widthChars={22}
                                xalign={0}
                                cssClasses={["monospace"]}
                            />
                            <GtkLabel label="Selection clipboard (middle-click)" wrap cssClasses={["dim-label"]} />
                        </GtkBox>
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Tips">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={8}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="1. Text widgets (Entry, TextView) handle clipboard automatically."
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />
                    <GtkLabel
                        label="2. Use clipboard.connect('changed', ...) to react to external changes."
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />
                    <GtkLabel
                        label="3. ContentProvider can offer data in multiple formats for compatibility."
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />
                    <GtkLabel
                        label="4. Clipboard operations are asynchronous - use async/await patterns."
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />
                </GtkBox>
            </GtkFrame>
        </GtkBox>
    );
};

export const clipboardDemo: Demo = {
    id: "clipboard",
    title: "Clipboard",
    description: "Copy and paste functionality with GdkClipboard",
    keywords: ["clipboard", "copy", "paste", "cut", "GdkClipboard", "ContentProvider", "text", "transfer"],
    component: ClipboardDemo,
    sourceCode,
};
