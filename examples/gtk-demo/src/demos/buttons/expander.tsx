import type * as GObject from "@gtkx/gi/gobject";
import * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";
import {
    GtkBox,
    GtkExpander,
    GtkLabel,
    GtkScrolledWindow,
    GtkTextBuffer,
    GtkTextChildAnchor,
    GtkTextTag,
    GtkTextView,
} from "@gtkx/jsx/gtk";
import { useParentWindow } from "@gtkx/react";
import { useState } from "react";
import type { Demo } from "../types.js";
import gtkLogoCursorPath from "../../../data/demos/buttons/gtk_logo_cursor.png?resource";
import sourceCode from "./expander.tsx?raw";

const DETAILS_TEXT =
    "Finally, the full story with all details. And all the inside information, including error codes, etc etc. " +
    "Pages of information, you might have to scroll down to read it all, or even resize the window - it works !\n" +
    "A second paragraph will contain even more innuendo, just to make you scroll down or resize the window.\n" +
    "Do it already!\n";

const expanderDemo: Demo = {
    id: "expander",
    title: "Expander",
    description:
        "GtkExpander allows to provide additional content that is initially hidden. " +
        'This is also known as "disclosure triangle".\n\n' +
        "This example also shows how to make the window resizable only if the expander is expanded.",
    keywords: ["gtkexpander"],
    component: ExpanderDemo,
    sourceCode,
};

const DetailsView = ({ texture }: { texture: Gdk.Texture }) => (
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
            buffer={(
                <GtkTextBuffer>
                    {DETAILS_TEXT}
                    <GtkTextTag name="logo" pixelsAboveLines={200} justification={Gtk.Justification.RIGHT}>
                        <GtkTextChildAnchor paintable={texture} />
                    </GtkTextTag>
                </GtkTextBuffer>
            )}
        />
    </GtkScrolledWindow>
);

function ExpanderDemo() {
    const [texture] = useState(() => Gdk.Texture.newFromResource(gtkLogoCursorPath));
    const parentWindow = useParentWindow();

    const handleExpandedNotify = (pspec: GObject.ParamSpec, self: Gtk.Expander) => {
        if (pspec.getName() !== "expanded") {
            return;
        }

        if (parentWindow) {
            parentWindow.setResizable(self.getExpanded());
        }
    };

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={10}
            marginStart={10}
            marginEnd={10}
            marginTop={10}
            marginBottom={10}
        >
            <GtkLabel useMarkup>{"<big><b>Something went wrong</b></big>"}</GtkLabel>
            <GtkLabel wrap={false} vexpand={false}>
                Here are some more details but not the full story
            </GtkLabel>

            <GtkExpander name="expander" label="Details:" vexpand onNotify={handleExpandedNotify}>
                <DetailsView texture={texture} />
            </GtkExpander>
        </GtkBox>
    );
}

export { expanderDemo };
