import { beginBatch, endBatch } from "@gtkx/ffi";
import * as GObject from "@gtkx/ffi/gobject";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkFrame, GtkLabel, GtkScrolledWindow, GtkTextView } from "@gtkx/react";
import { useEffect, useState } from "react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

const getBufferText = (buffer: Gtk.TextBuffer): string => {
    beginBatch();
    const startIter = new Gtk.TextIter();
    const endIter = new Gtk.TextIter();
    buffer.getStartIter(startIter);
    buffer.getEndIter(endIter);
    endBatch();
    const text = buffer.getText(startIter, endIter, true);
    return text;
};

const TextViewDemo = () => {
    const [buffer] = useState(() => new Gtk.TextBuffer());
    const [charCount, setCharCount] = useState(0);
    const [wordCount, setWordCount] = useState(0);

    useEffect(() => {
        const handlerId = buffer.connect("changed", () => {
            const text = getBufferText(buffer);
            setCharCount(text.length);
            const words = text
                .trim()
                .split(/\s+/)
                .filter((w) => w.length > 0);
            setWordCount(words.length);
        });

        return () => {
            GObject.signalHandlerDisconnect(buffer, handlerId);
        };
    }, [buffer]);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <GtkLabel label="TextView" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Multi-line Text Editor" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="<GtkTextView is a multi-line text editing widget. Type in the text area below to see the character and word count update."
                    wrap
                    cssClasses={["dim-label"]}
                />
                <GtkFrame.Root>
                    <GtkScrolledWindow minContentHeight={150} hexpand vexpand>
                        <GtkTextView
                            buffer={buffer}
                            leftMargin={8}
                            rightMargin={8}
                            topMargin={8}
                            bottomMargin={8}
                            wrapMode={Gtk.WrapMode.WORD_CHAR}
                        />
                    </GtkScrolledWindow>
                </GtkFrame.Root>
                <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={16}>
                    <GtkLabel label={`Characters: ${charCount}`} cssClasses={["dim-label"]} />
                    <GtkLabel label={`Words: ${wordCount}`} cssClasses={["dim-label"]} />
                </GtkBox>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Read-only TextView" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="A non-editable <GtkTextView can be used to display formatted text."
                    wrap
                    cssClasses={["dim-label"]}
                />
                <GtkFrame.Root>
                    <GtkScrolledWindow minContentHeight={100} hexpand>
                        <GtkTextView
                            editable={false}
                            cursorVisible={false}
                            leftMargin={8}
                            rightMargin={8}
                            topMargin={8}
                            bottomMargin={8}
                            wrapMode={Gtk.WrapMode.WORD}
                        />
                    </GtkScrolledWindow>
                </GtkFrame.Root>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Monospace TextView" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel label="Useful for code editing or displaying logs." wrap cssClasses={["dim-label"]} />
                <GtkFrame.Root>
                    <GtkScrolledWindow minContentHeight={100} hexpand>
                        <GtkTextView
                            monospace
                            leftMargin={8}
                            rightMargin={8}
                            topMargin={8}
                            bottomMargin={8}
                            wrapMode={Gtk.WrapMode.NONE}
                        />
                    </GtkScrolledWindow>
                </GtkFrame.Root>
            </GtkBox>
        </GtkBox>
    );
};

export const textViewDemo: Demo = {
    id: "text-view",
    title: "TextView",
    description: "Multi-line text editing widget with TextBuffer support.",
    keywords: ["textview", "text", "editor", "multiline", "GtkTextView", "TextBuffer"],
    component: TextViewDemo,
    sourcePath: getSourcePath(import.meta.url, "text-view.tsx"),
};
