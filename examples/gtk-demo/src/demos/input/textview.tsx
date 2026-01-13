import { beginBatch, endBatch } from "@gtkx/ffi";
import * as GObject from "@gtkx/ffi/gobject";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkFrame, GtkLabel, GtkScrolledWindow, GtkTextView } from "@gtkx/react";
import { useEffect, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./textview.tsx?raw";

const getBufferText = (buffer: Gtk.TextBuffer): string => {
    beginBatch();
    const startIter = new Gtk.TextIter();
    const endIter = new Gtk.TextIter();
    buffer.getStartIter(startIter);
    buffer.getEndIter(endIter);
    endBatch();
    return buffer.getText(startIter, endIter, true);
};

const TextViewDemo = () => {
    const [buffer] = useState(() => new Gtk.TextBuffer());
    const [charCount, setCharCount] = useState(0);
    const [wordCount, setWordCount] = useState(0);
    const [lineCount, setLineCount] = useState(1);

    useEffect(() => {
        const handlerId = buffer.connect("changed", () => {
            const text = getBufferText(buffer);
            setCharCount(text.length);
            const words = text
                .trim()
                .split(/\s+/)
                .filter((w) => w.length > 0);
            setWordCount(words.length);
            setLineCount(buffer.getLineCount());
        });

        return () => {
            GObject.signalHandlerDisconnect(buffer, handlerId);
        };
    }, [buffer]);

    const handleClear = () => {
        buffer.setText("", 0);
    };

    const handleInsertSample = () => {
        buffer.setText(
            "Lorem ipsum dolor sit amet, consectetur adipiscing elit.\n\nSed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.\n\nDuis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.",
            -1,
        );
    };

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <GtkLabel label="TextView" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Multi-line Text Editor" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="GtkTextView provides a powerful multi-line text editing widget with support for rich formatting through GtkTextBuffer. Type in the editor below to see live statistics."
                    wrap
                    cssClasses={["dim-label"]}
                />

                <GtkBox spacing={8}>
                    <GtkButton label="Insert Sample Text" onClicked={handleInsertSample} />
                    <GtkButton label="Clear" onClicked={handleClear} />
                </GtkBox>

                <GtkFrame>
                    <GtkScrolledWindow minContentHeight={200} hexpand vexpand>
                        <GtkTextView
                            buffer={buffer}
                            leftMargin={12}
                            rightMargin={12}
                            topMargin={12}
                            bottomMargin={12}
                            wrapMode={Gtk.WrapMode.WORD_CHAR}
                        />
                    </GtkScrolledWindow>
                </GtkFrame>

                <GtkBox spacing={16}>
                    <GtkLabel label={`Characters: ${charCount}`} cssClasses={["dim-label"]} />
                    <GtkLabel label={`Words: ${wordCount}`} cssClasses={["dim-label"]} />
                    <GtkLabel label={`Lines: ${lineCount}`} cssClasses={["dim-label"]} />
                </GtkBox>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Text Wrapping Modes" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="GtkTextView supports different wrapping modes for handling long lines."
                    wrap
                    cssClasses={["dim-label"]}
                />

                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                    <GtkLabel label="WRAP_NONE - No wrapping, horizontal scrolling:" halign={Gtk.Align.START} />
                    <GtkFrame>
                        <GtkScrolledWindow minContentHeight={60} hexpand>
                            <GtkTextView
                                wrapMode={Gtk.WrapMode.NONE}
                                leftMargin={8}
                                rightMargin={8}
                                topMargin={8}
                                bottomMargin={8}
                            />
                        </GtkScrolledWindow>
                    </GtkFrame>
                </GtkBox>

                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                    <GtkLabel label="WRAP_WORD - Break at word boundaries:" halign={Gtk.Align.START} />
                    <GtkFrame>
                        <GtkScrolledWindow minContentHeight={60} hexpand>
                            <GtkTextView
                                wrapMode={Gtk.WrapMode.WORD}
                                leftMargin={8}
                                rightMargin={8}
                                topMargin={8}
                                bottomMargin={8}
                            />
                        </GtkScrolledWindow>
                    </GtkFrame>
                </GtkBox>

                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                    <GtkLabel label="WRAP_CHAR - Break at any character:" halign={Gtk.Align.START} />
                    <GtkFrame>
                        <GtkScrolledWindow minContentHeight={60} hexpand>
                            <GtkTextView
                                wrapMode={Gtk.WrapMode.CHAR}
                                leftMargin={8}
                                rightMargin={8}
                                topMargin={8}
                                bottomMargin={8}
                            />
                        </GtkScrolledWindow>
                    </GtkFrame>
                </GtkBox>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Monospace Code Editor" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="Use the monospace property for code editing scenarios."
                    wrap
                    cssClasses={["dim-label"]}
                />
                <GtkFrame>
                    <GtkScrolledWindow minContentHeight={100} hexpand>
                        <GtkTextView
                            monospace
                            leftMargin={12}
                            rightMargin={12}
                            topMargin={12}
                            bottomMargin={12}
                            wrapMode={Gtk.WrapMode.NONE}
                        />
                    </GtkScrolledWindow>
                </GtkFrame>
            </GtkBox>
        </GtkBox>
    );
};

export const textviewDemo: Demo = {
    id: "textview",
    title: "Text View/Multiple Views",
    description: "Multi-line text editor with GtkTextBuffer.",
    keywords: ["textview", "text", "editor", "multiline", "GtkTextView", "buffer"],
    component: TextViewDemo,
    sourceCode,
};
