import * as Gdk from "@gtkx/ffi/gdk";
import * as GLib from "@gtkx/ffi/glib";
import * as Gtk from "@gtkx/ffi/gtk";
import * as Pango from "@gtkx/ffi/pango";
import { GtkImage, GtkLabel, GtkLevelBar, GtkScrolledWindow, GtkTextView, x } from "@gtkx/react";
import type { ReactNode } from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./hypertext.tsx?raw";

type LinkInfo = {
    id: string;
    targetPage: number;
    start: number;
    end: number;
};

const HypertextDemo = () => {
    const [currentPage, setCurrentPage] = useState(1);
    const textViewRef = useRef<Gtk.TextView | null>(null);

    const getIconPaintable = useCallback((iconName: string, size: number): Gtk.IconPaintable | null => {
        const textView = textViewRef.current;
        if (!textView) return null;
        const display = textView.getDisplay();
        const theme = Gtk.IconTheme.getForDisplay(display);
        return theme.lookupIcon(iconName, size, 1, Gtk.TextDirection.LTR, Gtk.IconLookupFlags.PRELOAD);
    }, []);

    const sayWord = useCallback((word: string): void => {
        GLib.spawnCommandLineAsync(`espeak-ng "${word}"`);
    }, []);

    const { content, linkInfos } = useMemo((): { content: ReactNode; linkInfos: LinkInfo[] } => {
        const links: LinkInfo[] = [];
        let offset = 0;

        const trackLink = (id: string, text: string, targetPage: number): void => {
            links.push({ id, targetPage, start: offset, end: offset + text.length });
            offset += text.length;
        };

        const trackText = (text: string): void => {
            offset += text.length;
        };

        const trackPlaceholder = (): void => {
            offset += 1;
        };

        if (currentPage === 1) {
            const nodes: ReactNode[] = [];

            const part1 = "Some text to show that simple ";
            trackText(part1);
            nodes.push(part1);

            trackLink("hypertext", "hypertext", 3);
            nodes.push(
                <x.TextTag
                    key="link-hypertext"
                    id="link-hypertext"
                    foreground="#1c71d8"
                    underline={Pango.Underline.SINGLE}
                >
                    hypertext
                </x.TextTag>,
            );

            const part2 = " can easily be realized with ";
            trackText(part2);
            nodes.push(part2);

            trackLink("tags", "tags", 2);
            nodes.push(
                <x.TextTag key="link-tags" id="link-tags" foreground="#1c71d8" underline={Pango.Underline.SINGLE}>
                    tags
                </x.TextTag>,
            );

            const part3 = ".\n\nOf course you can also embed Emoji 😋, icons ";
            trackText(part3);
            nodes.push(part3);

            trackPlaceholder();
            const iconPaintable = getIconPaintable("view-conceal-symbolic", 16);
            nodes.push(iconPaintable ? <x.TextPaintable key="icon" paintable={iconPaintable} /> : null);

            const part4 = ", or even widgets ";
            trackText(part4);
            nodes.push(part4);

            trackPlaceholder();
            nodes.push(
                <x.TextAnchor key="levelbar">
                    <GtkLevelBar value={0.5} minValue={0} maxValue={1} widthRequest={100} />
                </x.TextAnchor>,
            );

            const part5 = " and labels with ";
            trackText(part5);
            nodes.push(part5);

            trackPlaceholder();
            nodes.push(
                <x.TextAnchor key="ghost-label">
                    <GtkLabel label="ghost" cssClasses={["dim-label"]} />
                </x.TextAnchor>,
            );

            const part6 = " text.";
            trackText(part6);
            nodes.push(part6);

            return { content: nodes, linkInfos: links };
        }

        if (currentPage === 2) {
            const nodes: ReactNode[] = [];

            trackText("tag");
            nodes.push(
                <x.TextTag key="nobreaks" id="nobreaks" allowBreaks={false}>
                    <x.TextTag key="title" id="title" weight={Pango.Weight.BOLD} scale={1.44}>
                        tag
                    </x.TextTag>
                </x.TextTag>,
            );

            const slash1 = " /";
            trackText(slash1);
            nodes.push(
                <x.TextTag key="nobreaks2" id="nobreaks2" allowBreaks={false}>
                    {slash1}
                </x.TextTag>,
            );

            trackText("tag");
            nodes.push(
                <x.TextTag key="phonetic" id="phonetic" family="monospace">
                    tag
                </x.TextTag>,
            );

            const slash2 = "/ ";
            trackText(slash2);
            nodes.push(
                <x.TextTag key="nobreaks3" id="nobreaks3" allowBreaks={false}>
                    {slash2}
                </x.TextTag>,
            );

            trackPlaceholder();
            nodes.push(
                <x.TextAnchor key="speaker">
                    <GtkImage
                        iconName="audio-volume-high-symbolic"
                        cursor={new Gdk.Cursor("pointer")}
                        onPressed={() => sayWord("tag")}
                    />
                </x.TextAnchor>,
            );

            const definition =
                '\n\nAn attribute that can be applied to some range of text. For example, a tag might be called "bold" and make the text inside the tag bold.\n\nHowever, the tag concept is more general than that; tags don\'t have to affect appearance. They can instead affect the behavior of mouse and key presses, "lock" a range of text so the user can\'t edit it, or countless other things.\n\n';
            trackText(definition);
            nodes.push(definition);

            trackLink("goback", "Go back", 1);
            nodes.push(
                <x.TextTag key="link-goback" id="link-goback" foreground="#1c71d8" underline={Pango.Underline.SINGLE}>
                    Go back
                </x.TextTag>,
            );

            return { content: nodes, linkInfos: links };
        }

        if (currentPage === 3) {
            const nodes: ReactNode[] = [];

            trackText("hypertext");
            nodes.push(
                <x.TextTag key="nobreaks" id="nobreaks" allowBreaks={false}>
                    <x.TextTag key="title" id="title" weight={Pango.Weight.BOLD} scale={1.44}>
                        hypertext
                    </x.TextTag>
                </x.TextTag>,
            );

            const slash1 = " /";
            trackText(slash1);
            nodes.push(
                <x.TextTag key="nobreaks2" id="nobreaks2" allowBreaks={false}>
                    {slash1}
                </x.TextTag>,
            );

            trackText("ˈhaɪ pərˌtɛkst");
            nodes.push(
                <x.TextTag key="phonetic" id="phonetic" family="monospace">
                    ˈhaɪ pərˌtɛkst
                </x.TextTag>,
            );

            const slash2 = "/ ";
            trackText(slash2);
            nodes.push(
                <x.TextTag key="nobreaks3" id="nobreaks3" allowBreaks={false}>
                    {slash2}
                </x.TextTag>,
            );

            trackPlaceholder();
            nodes.push(
                <x.TextAnchor key="speaker">
                    <GtkImage
                        iconName="audio-volume-high-symbolic"
                        cursor={new Gdk.Cursor("pointer")}
                        onPressed={() => sayWord("hypertext")}
                    />
                </x.TextAnchor>,
            );

            const definition =
                "\n\nMachine-readable text that is not sequential but is organized so that related items of information are connected.\n\n";
            trackText(definition);
            nodes.push(definition);

            trackLink("goback", "Go back", 1);
            nodes.push(
                <x.TextTag key="link-goback" id="link-goback" foreground="#1c71d8" underline={Pango.Underline.SINGLE}>
                    Go back
                </x.TextTag>,
            );

            return { content: nodes, linkInfos: links };
        }

        return { content: null, linkInfos: [] };
    }, [currentPage, getIconPaintable, sayWord]);

    const findLinkAtOffset = useCallback(
        (offset: number): number | null => {
            for (const link of linkInfos) {
                if (offset >= link.start && offset < link.end) {
                    return link.targetPage;
                }
            }
            return null;
        },
        [linkInfos],
    );

    const handleClick = useCallback(
        (_nPress: number, clickX: number, clickY: number) => {
            const textView = textViewRef.current;
            if (!textView) return;

            const buffer = textView.getBuffer();
            const startIter = new Gtk.TextIter();
            const endIter = new Gtk.TextIter();
            buffer.getSelectionBounds(startIter, endIter);
            if (startIter.getOffset() !== endIter.getOffset()) return;

            const iter = new Gtk.TextIter();
            const result = textView.getIterAtPosition(iter, clickX, clickY);
            if (!result) return;

            const targetPage = findLinkAtOffset(iter.getOffset());
            if (targetPage !== null) {
                setCurrentPage(targetPage);
            }
        },
        [findLinkAtOffset],
    );

    const handleMotion = useCallback(
        (motionX: number, motionY: number) => {
            const textView = textViewRef.current;
            if (!textView) return;

            const iter = new Gtk.TextIter();
            const result = textView.getIterAtPosition(iter, motionX, motionY);
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
        (keyval: number) => {
            if (keyval === Gdk.KEY_Return || keyval === Gdk.KEY_KP_Enter) {
                const textView = textViewRef.current;
                if (!textView) return false;

                const buffer = textView.getBuffer();
                const iter = new Gtk.TextIter();
                buffer.getIterAtMark(iter, buffer.getInsert());

                const targetPage = findLinkAtOffset(iter.getOffset());
                if (targetPage !== null) {
                    setCurrentPage(targetPage);
                }
            }
            return false;
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
                canFocus
                focusable
                onPressed={handleClick}
                onMotion={handleMotion}
                onKeyPressed={handleKeyPress}
            >
                {content}
            </GtkTextView>
        </GtkScrolledWindow>
    );
};

export const hypertextDemo: Demo = {
    id: "hypertext",
    title: "Text View/Hypertext",
    description:
        "Usually, tags modify the appearance of text in the view, e.g. making it bold or colored or underlined. But tags are not restricted to appearance. They can also affect the behavior of mouse and key presses, as this demo shows. It also demonstrates embedded widgets using GtkTextChildAnchor and inline paintables.",
    keywords: [
        "text",
        "link",
        "hypertext",
        "GtkTextTag",
        "GtkTextView",
        "clickable",
        "embedded",
        "widget",
        "anchor",
        "paintable",
    ],
    component: HypertextDemo,
    sourceCode,
};
