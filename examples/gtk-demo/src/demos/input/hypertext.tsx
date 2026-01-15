import * as Gdk from "@gtkx/ffi/gdk";
import * as Gtk from "@gtkx/ffi/gtk";
import * as Pango from "@gtkx/ffi/pango";
import { GtkScrolledWindow, GtkTextView, x } from "@gtkx/react";
import { useCallback, useMemo, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./hypertext.tsx?raw";

interface Link {
    text: string;
    page: number;
}

interface Page {
    content: string;
    links: Link[];
}

const PAGES: Record<number, Page> = {
    1: {
        content: "Some text to show that simple hypertext can easily be realized with tags.",
        links: [
            { text: "hypertext", page: 3 },
            { text: "tags", page: 2 },
        ],
    },
    2: {
        content:
            'tag /tag/\n\nAn attribute that can be applied to some range of text. For example, a tag might be called "bold" and make the text inside the tag bold.\nHowever, the tag concept is more general than that; tags don\'t have to affect appearance. They can instead affect the behavior of mouse and key presses, "lock" a range of text so the user can\'t edit it, or countless other things.\n\nGo back',
        links: [{ text: "Go back", page: 1 }],
    },
    3: {
        content:
            "hypertext /ˈhaɪ pərˌtɛkst/\n\nMachine-readable text that is not sequential but is organized so that related items of information are connected.\n\nGo back",
        links: [{ text: "Go back", page: 1 }],
    },
};

interface LinkPosition extends Link {
    start: number;
    end: number;
}

const HypertextDemo = () => {
    const [currentPage, setCurrentPage] = useState(1);
    const textViewRef = useRef<Gtk.TextView | null>(null);

    const page = PAGES[currentPage] ?? PAGES[1];

    const linkPositions = useMemo((): LinkPosition[] => {
        return page.links.map((link) => {
            const start = page.content.indexOf(link.text);
            return {
                ...link,
                start,
                end: start + link.text.length,
            };
        });
    }, [page]);

    const findLinkAtOffset = useCallback(
        (offset: number): number | null => {
            for (const link of linkPositions) {
                if (offset >= link.start && offset < link.end) {
                    return link.page;
                }
            }
            return null;
        },
        [linkPositions],
    );

    const handleClick = useCallback(
        (_nPress: number, x: number, y: number) => {
            const textView = textViewRef.current;
            if (!textView) return;

            const iter = new Gtk.TextIter();
            const result = textView.getIterAtPosition(iter, x, y);
            if (!result) return;

            const targetPage = findLinkAtOffset(iter.getOffset());
            if (targetPage !== null) {
                setCurrentPage(targetPage);
            }
        },
        [findLinkAtOffset],
    );

    const handleMotion = useCallback(
        (x: number, y: number) => {
            const textView = textViewRef.current;
            if (!textView) return;

            const iter = new Gtk.TextIter();
            const result = textView.getIterAtPosition(iter, x, y);
            if (!result) {
                textView.setCursor(new Gdk.Cursor("text"));
                return;
            }

            const targetPage = findLinkAtOffset(iter.getOffset());
            if (targetPage !== null) {
                textView.setCursor(new Gdk.Cursor("pointer"));
            } else {
                textView.setCursor(new Gdk.Cursor("text"));
            }
        },
        [findLinkAtOffset],
    );

    return (
        <GtkScrolledWindow hscrollbarPolicy={Gtk.PolicyType.NEVER} vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}>
            <GtkTextView
                ref={textViewRef}
                wrapMode={Gtk.WrapMode.WORD}
                topMargin={20}
                bottomMargin={20}
                leftMargin={20}
                rightMargin={20}
                pixelsBelowLines={10}
                editable={false}
                onPressed={handleClick}
                onMotion={handleMotion}
            >
                <x.TextBuffer text={page.content}>
                    {linkPositions.map((link) => (
                        <x.TextTag
                            key={`${currentPage}-${link.text}`}
                            id={link.text}
                            foreground="blue"
                            underline={Pango.Underline.SINGLE}
                            start={link.start}
                            end={link.end}
                        />
                    ))}
                </x.TextBuffer>
            </GtkTextView>
        </GtkScrolledWindow>
    );
};

export const hypertextDemo: Demo = {
    id: "hypertext",
    title: "Text View/Hypertext",
    description:
        "Usually, tags modify the appearance of text in the view, e.g. making it bold or colored or underlined. But tags are not restricted to appearance. They can also affect the behavior of mouse and key presses, as this demo shows.",
    keywords: ["text", "link", "hypertext", "GtkTextTag", "GtkTextView", "clickable"],
    component: HypertextDemo,
    sourceCode,
};
