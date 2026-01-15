import * as Gdk from "@gtkx/ffi/gdk";
import * as Gtk from "@gtkx/ffi/gtk";
import * as Pango from "@gtkx/ffi/pango";
import { GtkButton, GtkLabel, GtkLevelBar, GtkScrolledWindow, GtkTextView, x } from "@gtkx/react";
import type { ReactNode } from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./hypertext.tsx?raw";

interface Link {
    text: string;
    page: number;
}

interface EmbeddedWidget {
    type: "levelbar" | "label";
    position: number;
    props?: Record<string, unknown>;
}

interface Page {
    content: string;
    links: Link[];
    widgets?: EmbeddedWidget[];
}

const PAGES: Record<number, Page> = {
    1: {
        content: "Some text to show that simple hypertext can easily be realized with tags. This demo also shows embedded widgets like a volume indicator: [WIDGET] and replaceable text like the 👻 ghost.",
        links: [
            { text: "hypertext", page: 3 },
            { text: "tags", page: 2 },
            { text: "embedded widgets", page: 4 },
        ],
        widgets: [
            { type: "levelbar", position: 106, props: { value: 0.6, minValue: 0, maxValue: 1, widthRequest: 100 } },
            { type: "label", position: 154, props: { label: "ghost", cssClasses: ["dim-label", "caption"] } },
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
    4: {
        content:
            "Embedded Widgets\n\nGtkTextView supports embedding arbitrary widgets within text using GtkTextChildAnchor. The anchor marks a position in the text buffer where a widget can be attached.\n\nHere's a progress indicator: [WIDGET]\n\nAnd a button: [WIDGET]\n\nWidgets flow with the text and can be used for interactive elements, status indicators, or inline controls.\n\nGo back",
        links: [{ text: "Go back", page: 1 }],
        widgets: [
            { type: "levelbar", position: 217, props: { value: 0.75, minValue: 0, maxValue: 1, widthRequest: 150 } },
            { type: "label", position: 236, props: { label: "Click Me", cssClasses: ["accent"] } },
        ],
    },
};

interface LinkPosition extends Link {
    start: number;
    end: number;
}

type TextSegment =
    | { type: "text"; content: string }
    | { type: "link"; link: LinkPosition; linkIndex: number }
    | { type: "widget"; widget: EmbeddedWidget };

const buildTextSegments = (
    content: string,
    links: LinkPosition[],
    widgets: EmbeddedWidget[],
): TextSegment[] => {
    const markers: Array<{ position: number; length: number; segment: TextSegment }> = [];

    for (let i = 0; i < links.length; i++) {
        const link = links[i]!;
        markers.push({
            position: link.start,
            length: link.end - link.start,
            segment: { type: "link", link, linkIndex: i },
        });
    }

    for (const widget of widgets) {
        const pos = content.indexOf("[WIDGET]", widget.position - 10);
        if (pos !== -1) {
            markers.push({
                position: pos,
                length: 8,
                segment: { type: "widget", widget },
            });
        }
    }

    markers.sort((a, b) => a.position - b.position);

    if (markers.length === 0) {
        return [{ type: "text", content }];
    }

    const segments: TextSegment[] = [];
    let lastEnd = 0;

    for (const marker of markers) {
        if (marker.position > lastEnd) {
            segments.push({ type: "text", content: content.slice(lastEnd, marker.position) });
        }
        segments.push(marker.segment);
        lastEnd = marker.position + marker.length;
    }

    if (lastEnd < content.length) {
        segments.push({ type: "text", content: content.slice(lastEnd) });
    }

    return segments;
};

const HypertextDemo = () => {
    const [currentPage, setCurrentPage] = useState(1);
    const [focusedLinkIndex, setFocusedLinkIndex] = useState(-1);
    const textViewRef = useRef<Gtk.TextView | null>(null);

    const page = PAGES[currentPage] ?? PAGES[1] ?? { content: "", links: [] };

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

    const textSegments = useMemo(
        () => buildTextSegments(page.content, linkPositions, page.widgets ?? []),
        [page.content, linkPositions, page.widgets],
    );

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
                setFocusedLinkIndex(-1);
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

    const handleKeyPress = useCallback(
        (_keyval: number, _keycode: number, _state: Gdk.ModifierType) => {
            const keyval = _keyval;
            const linkCount = linkPositions.length;

            if (keyval === Gdk.KEY_Tab || keyval === Gdk.KEY_ISO_Left_Tab) {
                const shift = (_state & Gdk.ModifierType.SHIFT_MASK) !== 0 || keyval === Gdk.KEY_ISO_Left_Tab;
                if (shift) {
                    setFocusedLinkIndex((prev) => (prev <= 0 ? linkCount - 1 : prev - 1));
                } else {
                    setFocusedLinkIndex((prev) => (prev >= linkCount - 1 ? 0 : prev + 1));
                }
                return true;
            }

            if ((keyval === Gdk.KEY_Return || keyval === Gdk.KEY_KP_Enter) && focusedLinkIndex >= 0) {
                const link = linkPositions[focusedLinkIndex];
                if (link) {
                    setCurrentPage(link.page);
                    setFocusedLinkIndex(-1);
                }
                return true;
            }

            return false;
        },
        [linkPositions, focusedLinkIndex],
    );

    const renderTextContent = (): ReactNode[] => {
        return textSegments.map((segment, index) => {
            if (segment.type === "text") {
                return segment.content;
            }
            if (segment.type === "widget") {
                const w = segment.widget;
                if (w.type === "levelbar") {
                    return (
                        <x.TextAnchor key={`widget-${index}`}>
                            <GtkLevelBar
                                value={(w.props?.value as number) ?? 0.5}
                                minValue={(w.props?.minValue as number) ?? 0}
                                maxValue={(w.props?.maxValue as number) ?? 1}
                                widthRequest={(w.props?.widthRequest as number) ?? 100}
                            />
                        </x.TextAnchor>
                    );
                }
                if (w.type === "label") {
                    return (
                        <x.TextAnchor key={`widget-${index}`}>
                            <GtkButton cssClasses={["flat", "pill"]}>
                                <GtkLabel
                                    label={(w.props?.label as string) ?? "Widget"}
                                    cssClasses={(w.props?.cssClasses as string[]) ?? []}
                                />
                            </GtkButton>
                        </x.TextAnchor>
                    );
                }
                return null;
            }
            const isFocused = segment.linkIndex === focusedLinkIndex;
            return (
                <x.TextTag
                    key={`${currentPage}-${segment.link.text}-${index}`}
                    id={`link-${segment.link.text}-${index}`}
                    foreground="blue"
                    underline={Pango.Underline.SINGLE}
                    background={isFocused ? "alpha(blue, 0.2)" : undefined}
                >
                    {segment.link.text}
                </x.TextTag>
            );
        });
    };

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
                canFocus
                focusable
                onPressed={handleClick}
                onMotion={handleMotion}
                onKeyPressed={handleKeyPress}
            >
                <x.TextBuffer key={`${currentPage}-${focusedLinkIndex}`}>{renderTextContent()}</x.TextBuffer>
            </GtkTextView>
        </GtkScrolledWindow>
    );
};

export const hypertextDemo: Demo = {
    id: "hypertext",
    title: "Text View/Hypertext",
    description:
        "Usually, tags modify the appearance of text in the view, e.g. making it bold or colored or underlined. But tags are not restricted to appearance. They can also affect the behavior of mouse and key presses, as this demo shows. It also demonstrates embedded widgets using GtkTextChildAnchor.",
    keywords: ["text", "link", "hypertext", "GtkTextTag", "GtkTextView", "clickable", "embedded", "widget", "anchor", "keyboard"],
    component: HypertextDemo,
    sourceCode,
};
