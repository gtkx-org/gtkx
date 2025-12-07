import * as Gtk from "@gtkx/ffi/gtk";
import { Box, Frame, Label, ScrolledWindow, TextView } from "@gtkx/react";
import { useState } from "react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

const TextViewDemo = () => {
    const [charCount, setCharCount] = useState(0);
    const [wordCount, setWordCount] = useState(0);

    const handleTextChanged = (text: string) => {
        setCharCount(text.length);
        const words = text.trim().split(/\s+/).filter((w) => w.length > 0);
        setWordCount(words.length);
    };

    return (
        <Box orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <Label.Root label="TextView" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Multi-line Text Editor" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label.Root
                    label="TextView is a multi-line text editing widget. Type in the text area below to see the character and word count update."
                    wrap
                    cssClasses={["dim-label"]}
                />
                <Frame.Root>
                    <ScrolledWindow minContentHeight={150} hexpand vexpand>
                        <TextView
                            onChanged={handleTextChanged}
                            leftMargin={8}
                            rightMargin={8}
                            topMargin={8}
                            bottomMargin={8}
                            wrapMode={Gtk.WrapMode.WORD_CHAR}
                        />
                    </ScrolledWindow>
                </Frame.Root>
                <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={16}>
                    <Label.Root label={`Characters: ${charCount}`} cssClasses={["dim-label"]} />
                    <Label.Root label={`Words: ${wordCount}`} cssClasses={["dim-label"]} />
                </Box>
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Read-only TextView" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label.Root
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
                <Label.Root label="Monospace TextView" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label.Root
                    label="Useful for code editing or displaying logs."
                    wrap
                    cssClasses={["dim-label"]}
                />
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
    description: "Multi-line text editing widget with onChanged support.",
    keywords: ["textview", "text", "editor", "multiline", "GtkTextView", "onChanged"],
    component: TextViewDemo,
    sourcePath: getSourcePath(import.meta.url, "text-view.tsx"),
};
