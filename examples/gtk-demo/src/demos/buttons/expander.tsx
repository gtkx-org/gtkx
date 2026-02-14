import * as Gdk from "@gtkx/ffi/gdk";
import type * as GObject from "@gtkx/ffi/gobject";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkExpander, GtkLabel, GtkScrolledWindow, GtkTextView, x } from "@gtkx/react";
import { useCallback, useMemo, useRef } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./expander.tsx?raw";
import gtkLogoCursorPath from "./gtk_logo_cursor.png";

const DETAILS_TEXT = `Finally, the full story with all details. And all the inside information, including error codes, etc etc. Pages of information, you might have to scroll down to read it all, or even resize the window - it works !
A second paragraph will contain even more innuendo, just to make you scroll down or resize the window.
Do it already!`;

const ExpanderDemo = () => {
    const texture = useMemo(() => Gdk.Texture.newFromFilename(gtkLogoCursorPath), []);
    const expanderRef = useRef<Gtk.Expander | null>(null);

    const handleExpandedNotify = useCallback((pspec: GObject.ParamSpec) => {
        if (pspec.getName() !== "expanded") return;
        const expander = expanderRef.current;
        if (!expander) return;

        const root = expander.getRoot();
        if (!root) return;

        const win = root instanceof Gtk.Window ? root : null;
        if (win) win.setResizable(expander.getExpanded());
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

            <GtkExpander label="Details:" vexpand ref={expanderRef} onNotify={handleExpandedNotify}>
                <GtkScrolledWindow
                    minContentHeight={100}
                    hasFrame
                    hscrollbarPolicy={Gtk.PolicyType.NEVER}
                    vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
                    propagateNaturalHeight
                    vexpand
                >
                    <GtkTextView
                        editable={false}
                        cursorVisible={false}
                        wrapMode={Gtk.WrapMode.WORD}
                        pixelsAboveLines={2}
                        pixelsBelowLines={2}
                        leftMargin={10}
                        rightMargin={10}
                        topMargin={10}
                        bottomMargin={10}
                    >
                        {DETAILS_TEXT}
                        <x.TextTag id="logo" pixelsAboveLines={200} justification={Gtk.Justification.RIGHT}>
                            <x.TextPaintable paintable={texture} />
                        </x.TextTag>
                    </GtkTextView>
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
