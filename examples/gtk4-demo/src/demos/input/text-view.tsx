import * as GObject from "@gtkx/ffi/gobject";
import * as Gtk from "@gtkx/ffi/gtk";
import { Box, Frame, Label, ScrolledWindow, TextView } from "@gtkx/react";
import { useEffect, useState } from "react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

const getBufferText = (buffer: Gtk.TextBuffer): string => {
    const startIter = new Gtk.TextIter();
    const endIter = new Gtk.TextIter();
    buffer.getStartIter(startIter);
    buffer.getEndIter(endIter);
    return buffer.getText(startIter, endIter, true);
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
        <Box orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <Label label="TextView" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label label="Multi-line Text Editor" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label
                    label="TextView is a multi-line text editing widget. Type in the text area below to see the character and word count update."
                    wrap
                    cssClasses={["dim-label"]}
                />
                <Frame.Root>
                    <ScrolledWindow minContentHeight={150} hexpand vexpand>
                        <TextView
                            buffer={buffer}
                            leftMargin={8}
                            rightMargin={8}
                            topMargin={8}
                            bottomMargin={8}
                            wrapMode={Gtk.WrapMode.WORD_CHAR}
                        />
                    </ScrolledWindow>
                </Frame.Root>
                <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={16}>
                    <Label label={`Characters: ${charCount}`} cssClasses={["dim-label"]} />
                    <Label label={`Words: ${wordCount}`} cssClasses={["dim-label"]} />
                </Box>
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label label="Read-only TextView" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label
                    label="A non-editable TextView can be used to display formatted text."
                    wrap
                    cssClasses={["dim-label"]}
                />
                <Frame.Root>
                    <ScrolledWindow minContentHeight={100} hexpand>
                        <TextView
                            editable={false}
                            cursorVisible={false}
                            leftMargin={8}
                            rightMargin={8}
                            topMargin={8}
                            bottomMargin={8}
                            wrapMode={Gtk.WrapMode.WORD}
                        />
                    </ScrolledWindow>
                </Frame.Root>
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label label="Monospace TextView" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label label="Useful for code editing or displaying logs." wrap cssClasses={["dim-label"]} />
                <Frame.Root>
                    <ScrolledWindow minContentHeight={100} hexpand>
                        <TextView
                            monospace
                            leftMargin={8}
                            rightMargin={8}
                            topMargin={8}
                            bottomMargin={8}
                            wrapMode={Gtk.WrapMode.NONE}
                        />
                    </ScrolledWindow>
                </Frame.Root>
            </Box>
        </Box>
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
