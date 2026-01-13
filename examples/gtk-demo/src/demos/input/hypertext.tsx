import { css } from "@gtkx/css";
import { beginBatch, createRef, endBatch } from "@gtkx/ffi";
import * as Gdk from "@gtkx/ffi/gdk";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkFrame, GtkLabel, GtkScrolledWindow, GtkTextView } from "@gtkx/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./hypertext.tsx?raw";

const hypertextViewStyle = css`
 font-size: 14px;
 padding: 16px;

 &:focus {
 outline: none;
 }
`;

interface Link {
    start: number;
    end: number;
    url: string;
    text: string;
}

const SAMPLE_LINKS: Link[] = [
    { start: 0, end: 4, url: "https://gtk.org", text: "GTK" },
    { start: 45, end: 50, url: "https://gnome.org", text: "GNOME" },
    { start: 95, end: 101, url: "https://github.com", text: "GitHub" },
];

const SAMPLE_TEXT = `GTK is the toolkit used to create graphical user interfaces for GNOME and many other applications. Visit GNOME for more information about the desktop environment. Check out GitHub for the source code.`;

const HypertextDemo = () => {
    const [buffer] = useState(() => new Gtk.TextBuffer());
    const [hoveredLink, setHoveredLink] = useState<string | null>(null);
    const [clickedLink, setClickedLink] = useState<string | null>(null);
    const textViewRef = useRef<Gtk.TextView | null>(null);

    const linkTag = useMemo(() => {
        const tag = new Gtk.TextTag("link");
        return tag;
    }, []);

    const hoverTag = useMemo(() => {
        const tag = new Gtk.TextTag("link-hover");
        return tag;
    }, []);

    useEffect(() => {
        const tagTable = buffer.getTagTable();
        tagTable.add(linkTag);
        tagTable.add(hoverTag);

        buffer.setText(SAMPLE_TEXT, -1);

        beginBatch();
        for (const link of SAMPLE_LINKS) {
            const startIter = new Gtk.TextIter();
            const endIter = new Gtk.TextIter();
            buffer.getIterAtOffset(startIter, link.start);
            buffer.getIterAtOffset(endIter, link.end);
            buffer.applyTag(linkTag, startIter, endIter);
        }
        endBatch();
    }, [buffer, linkTag, hoverTag]);

    const handleMotion = (x: number, y: number) => {
        const textView = textViewRef.current;
        if (!textView) return;

        const bufferXRef = createRef(0);
        const bufferYRef = createRef(0);
        textView.windowToBufferCoords(Gtk.TextWindowType.WIDGET, x, y, bufferXRef, bufferYRef);

        const iter = new Gtk.TextIter();
        textView.getIterAtLocation(iter, bufferXRef.value, bufferYRef.value);
        const offset = iter.getOffset();

        let foundLink: Link | null = null;
        for (const link of SAMPLE_LINKS) {
            if (offset >= link.start && offset < link.end) {
                foundLink = link;
                break;
            }
        }

        if (foundLink) {
            setHoveredLink(foundLink.url);
            textView.setCursor(new Gdk.Cursor("pointer"));
        } else {
            setHoveredLink(null);
            textView.setCursor(new Gdk.Cursor("text"));
        }
    };

    const handleClick = (_nPress: number, x: number, y: number) => {
        const textView = textViewRef.current;
        if (!textView) return;

        const bufferXRef = createRef(0);
        const bufferYRef = createRef(0);
        textView.windowToBufferCoords(Gtk.TextWindowType.WIDGET, x, y, bufferXRef, bufferYRef);

        const iter = new Gtk.TextIter();
        textView.getIterAtLocation(iter, bufferXRef.value, bufferYRef.value);
        const offset = iter.getOffset();

        for (const link of SAMPLE_LINKS) {
            if (offset >= link.start && offset < link.end) {
                setClickedLink(link.url);
                return;
            }
        }
    };

    const clearClicked = () => setClickedLink(null);

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={20}
            marginStart={20}
            marginEnd={20}
            marginTop={20}
            marginBottom={20}
        >
            <GtkLabel label="Hypertext" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="GtkTextView supports rich text with clickable links using GtkTextTag. Tags can style text with colors, underlines, and other properties. Combined with gesture handlers, you can create interactive hypertext."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkFrame label="Interactive Text">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginStart={16}
                    marginEnd={16}
                    marginTop={16}
                    marginBottom={16}
                >
                    <GtkScrolledWindow minContentHeight={120} cssClasses={["card"]}>
                        <GtkTextView
                            ref={textViewRef}
                            buffer={buffer}
                            editable={false}
                            cursorVisible={false}
                            wrapMode={Gtk.WrapMode.WORD}
                            cssClasses={[hypertextViewStyle]}
                            onMotion={handleMotion}
                            onPressed={handleClick}
                        />
                    </GtkScrolledWindow>

                    <GtkBox spacing={12}>
                        <GtkLabel label="Hovered:" cssClasses={["dim-label"]} />
                        <GtkLabel label={hoveredLink ?? "None"} cssClasses={hoveredLink ? ["heading"] : []} hexpand />
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            {clickedLink && (
                <GtkFrame label="Link Clicked">
                    <GtkBox spacing={12} marginStart={16} marginEnd={16} marginTop={16} marginBottom={16}>
                        <GtkLabel label={clickedLink} hexpand cssClasses={["heading"]} />
                        <GtkButton label="Dismiss" onClicked={clearClicked} cssClasses={["flat"]} />
                    </GtkBox>
                </GtkFrame>
            )}

            <GtkFrame label="Links in this Demo">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={8}
                    marginStart={16}
                    marginEnd={16}
                    marginTop={16}
                    marginBottom={16}
                >
                    {SAMPLE_LINKS.map((link) => (
                        <GtkBox key={link.url} spacing={12}>
                            <GtkLabel
                                label={link.text}
                                cssClasses={["heading"]}
                                widthRequest={80}
                                halign={Gtk.Align.START}
                            />
                            <GtkLabel label={link.url} cssClasses={["dim-label"]} hexpand halign={Gtk.Align.START} />
                        </GtkBox>
                    ))}
                </GtkBox>
            </GtkFrame>

            <GtkLabel
                label="Implementation uses GtkTextTag for styling (foreground color, underline), EventControllerMotion for hover detection, and GestureClick for click handling."
                wrap
                cssClasses={["dim-label", "caption"]}
                halign={Gtk.Align.START}
            />
        </GtkBox>
    );
};

export const hypertextDemo: Demo = {
    id: "hypertext",
    title: "Hypertext",
    description: "Clickable links within text using GtkTextTag",
    keywords: ["text", "link", "hypertext", "url", "clickable", "GtkTextTag", "GtkTextView"],
    component: HypertextDemo,
    sourceCode,
};
