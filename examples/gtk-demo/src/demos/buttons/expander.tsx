import path from "node:path";
import * as Gdk from "@gtkx/ffi/gdk";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkExpander, GtkLabel, GtkScrolledWindow, GtkTextView } from "@gtkx/react";
import { useCallback, useEffect, useRef } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./expander.tsx?raw";

const DETAILS_TEXT = `Finally, the full story with all details. And all the inside information, including error codes, etc etc. Pages of information, you might have to scroll down to read it all, or even resize the window - it works !
A second paragraph will contain even more innuendo, just to make you scroll down or resize the window.
Do it already!`;

const ExpanderDemo = () => {
    const textViewRef = useRef<Gtk.TextView | null>(null);
    const expanderRef = useRef<Gtk.Expander | null>(null);

    const handleExpandedChanged = useCallback((expander: Gtk.Expander, propName: string) => {
        if (propName !== "expanded") return;

        const root = expander.getRoot();
        if (!root) return;

        const window = root as unknown as Gtk.Window;
        window.setResizable(expander.getExpanded());
    }, []);

    useEffect(() => {
        const textView = textViewRef.current;
        if (!textView) return;

        const buffer = textView.getBuffer();
        if (!buffer) return;

        buffer.setText(DETAILS_TEXT, -1);

        const logoPath = path.resolve(import.meta.dirname, "gtk_logo_cursor.png");
        const texture = Gdk.Texture.newFromFilename(logoPath);

        const endIter = new Gtk.TextIter();
        buffer.getEndIter(endIter);
        buffer.insertPaintable(endIter, texture);

        const startIter = new Gtk.TextIter();
        buffer.getEndIter(startIter);
        startIter.backwardChar();

        buffer.getEndIter(endIter);

        const tag = new Gtk.TextTag(null);
        tag.setPixelsAboveLines(200);
        tag.setJustification(Gtk.Justification.RIGHT);
        buffer.getTagTable().add(tag);
        buffer.applyTag(tag, startIter, endIter);
    }, []);

    useEffect(() => {
        const expander = expanderRef.current;
        if (!expander) return;

        const root = expander.getRoot();
        if (!root) return;

        const window = root as unknown as Gtk.Window;
        window.setResizable(expander.getExpanded());
    }, []);

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={10}
            marginStart={10}
            marginEnd={10}
            marginTop={10}
            marginBottom={10}
        >
            <GtkLabel label="<big><b>Something went wrong</b></big>" useMarkup />
            <GtkLabel label="Here are some more details but not the full story" wrap={false} vexpand={false} />

            <GtkExpander ref={expanderRef} label="Details:" vexpand onNotify={handleExpandedChanged}>
                <GtkScrolledWindow
                    minContentHeight={100}
                    hasFrame
                    hscrollbarPolicy={Gtk.PolicyType.NEVER}
                    vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
                    propagateNaturalHeight
                    vexpand
                >
                    <GtkTextView
                        ref={textViewRef}
                        editable={false}
                        cursorVisible={false}
                        wrapMode={Gtk.WrapMode.WORD}
                        pixelsAboveLines={2}
                        pixelsBelowLines={2}
                        leftMargin={10}
                        rightMargin={10}
                        topMargin={10}
                        bottomMargin={10}
                    />
                </GtkScrolledWindow>
            </GtkExpander>
        </GtkBox>
    );
};

export const expanderDemo: Demo = {
    id: "expander",
    title: "Expander",
    description:
        'GtkExpander allows to provide additional content that is initially hidden. This is also known as "disclosure triangle". The official GTK demo also demonstrates making the window resizable only when the expander is expanded.',
    keywords: ["expander", "collapse", "expand", "toggle", "GtkExpander", "disclosure", "triangle", "details"],
    component: ExpanderDemo,
    sourceCode,
};
