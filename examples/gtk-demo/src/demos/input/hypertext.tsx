import { spawn } from "node:child_process";
import * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";
import * as Pango from "@gtkx/gi/pango";
import {
    GtkEventControllerKey,
    GtkEventControllerMotion,
    GtkGestureClick,
    GtkImage,
    GtkLabel,
    GtkLevelBar,
    GtkScrolledWindow,
    GtkTextView,
} from "@gtkx/react";
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

interface PageBuilder {
    nodes: ReactNode[];
    links: LinkInfo[];
    offset: number;
    trackText: (text: string) => ReactNode;
    trackLink: (id: string, text: string, targetPage: number) => void;
    trackPlaceholder: () => void;
}

const createPageBuilder = (): PageBuilder => {
    const nodes: ReactNode[] = [];
    const links: LinkInfo[] = [];
    const builder: PageBuilder = {
        nodes,
        links,
        offset: 0,
        trackText: (text: string) => {
            builder.offset += text.length;
            return text;
        },
        trackLink: (id: string, text: string, targetPage: number) => {
            links.push({ id, targetPage, start: builder.offset, end: builder.offset + text.length });
            builder.offset += text.length;
        },
        trackPlaceholder: () => {
            builder.offset += 1;
        },
    };
    return builder;
};

const buildPage1 = (
    getIconPaintable: (iconName: string, size: number) => Gtk.IconPaintable | null,
): { content: ReactNode; linkInfos: LinkInfo[] } => {
    const b = createPageBuilder();
    b.nodes.push(b.trackText("Some text to show that simple "));
    b.trackLink("hypertext", "hypertext", 3);
    b.nodes.push(
        <GtkTextView.Tag key="link-hypertext" id="link-hypertext" foreground="blue" underline={Pango.Underline.SINGLE}>
            hypertext
        </GtkTextView.Tag>,
    );
    b.nodes.push(b.trackText(" can easily be realized with "));
    b.trackLink("tags", "tags", 2);
    b.nodes.push(
        <GtkTextView.Tag key="link-tags" id="link-tags" foreground="blue" underline={Pango.Underline.SINGLE}>
            tags
        </GtkTextView.Tag>,
    );
    b.nodes.push(b.trackText(".\nOf course you can also embed Emoji 😋, "));
    b.nodes.push(b.trackText("icons "));

    b.trackPlaceholder();
    const iconPaintable = getIconPaintable("view-conceal-symbolic", 16);
    b.nodes.push(iconPaintable ? <GtkTextView.Paintable key="icon" paintable={iconPaintable} /> : null);

    b.nodes.push(b.trackText(", or even widgets "));
    b.trackPlaceholder();
    b.nodes.push(
        <GtkTextView.Anchor key="levelbar">
            <GtkLevelBar value={50} minValue={0} maxValue={100} widthRequest={100} />
        </GtkTextView.Anchor>,
    );

    b.nodes.push(b.trackText(" and labels with "));
    b.trackPlaceholder();
    b.nodes.push(
        <GtkTextView.Anchor key="ghost-anchor" replacementChar="👻">
            <GtkLabel label="ghost" />
        </GtkTextView.Anchor>,
    );

    b.nodes.push(b.trackText(" text."));
    return { content: b.nodes, linkInfos: b.links };
};

const buildPage2 = (sayWord: (word: string) => void) =>
    buildDefinitionPage({
        title: "tag",
        phonetic: "tag",
        definition:
            '\n\nAn attribute that can be applied to some range of text. For example, a tag might be called "bold" and make the text inside the tag bold.\n\nHowever, the tag concept is more general than that; tags don\'t have to affect appearance. They can instead affect the behavior of mouse and key presses, "lock" a range of text so the user can\'t edit it, or countless other things.\n',
        sayWord,
    });

const buildPage3 = (sayWord: (word: string) => void) =>
    buildDefinitionPage({
        title: "hypertext",
        phonetic: "ˈhaɪ pərˌtɛkst",
        definition:
            "\n\nMachine-readable text that is not sequential but is organized so that related items of information are connected.\n",
        sayWord,
    });

interface DefinitionPageArgs {
    title: string;
    phonetic: string;
    definition: string;
    sayWord: (word: string) => void;
}

const buildDefinitionPage = ({ title, phonetic, definition, sayWord }: DefinitionPageArgs) => {
    const b = createPageBuilder();
    b.trackText(title);
    b.trackText(" /");
    b.trackText(" ");
    b.trackText(phonetic);
    b.trackText(" /");
    b.trackText(" ");
    b.trackPlaceholder();
    b.nodes.push(
        <GtkTextView.Tag key="nobreaks" id="nobreaks" allowBreaks={false}>
            <GtkTextView.Tag key="title" id="title" weight={Pango.Weight.BOLD} scale={1.44}>
                {title}
            </GtkTextView.Tag>
            {" / "}
            <GtkTextView.Tag key="phonetic" id="phonetic" family="monospace">
                {phonetic}
            </GtkTextView.Tag>
            {" / "}
            <GtkTextView.Anchor key="speaker">
                <GtkImage iconName="audio-volume-high-symbolic" cursor={Gdk.Cursor.newFromName("pointer", null)}>
                    <GtkGestureClick onPressed={() => sayWord(title)} />
                </GtkImage>
            </GtkTextView.Anchor>
        </GtkTextView.Tag>,
    );
    b.nodes.push(b.trackText(definition));
    b.trackLink("goback", "Go back", 1);
    b.nodes.push(
        <GtkTextView.Tag key="link-goback" id="link-goback" foreground="blue" underline={Pango.Underline.SINGLE}>
            Go back
        </GtkTextView.Tag>,
    );
    return { content: b.nodes, linkInfos: b.links };
};

const buildPageContent = (
    currentPage: number,
    getIconPaintable: (iconName: string, size: number) => Gtk.IconPaintable | null,
    sayWord: (word: string) => void,
): { content: ReactNode; linkInfos: LinkInfo[] } => {
    if (currentPage === 1) return buildPage1(getIconPaintable);
    if (currentPage === 2) return buildPage2(sayWord);
    if (currentPage === 3) return buildPage3(sayWord);
    return { content: null, linkInfos: [] };
};

function useHypertextHandlers(
    textViewRef: React.RefObject<Gtk.TextView | null>,
    findLinkAtOffset: (offset: number) => number | null,
    setCurrentPage: (page: number) => void,
) {
    const hoveringRef = useRef(false);
    const handleClick = useClickHandler(textViewRef, findLinkAtOffset, setCurrentPage);
    const handleMotion = useMotionHandler(textViewRef, findLinkAtOffset, hoveringRef);
    const handleKeyPress = useKeyPressHandler(textViewRef, findLinkAtOffset, setCurrentPage);
    return { handleClick, handleMotion, handleKeyPress };
}

function useClickHandler(
    textViewRef: React.RefObject<Gtk.TextView | null>,
    findLinkAtOffset: (offset: number) => number | null,
    setCurrentPage: (page: number) => void,
) {
    return useCallback(
        (_nPress: number, clickX: number, clickY: number) => {
            const textView = textViewRef.current;
            if (!textView) return;
            const buffer = textView.getBuffer();
            const [, startIter, endIter] = buffer.getSelectionBounds();
            if (startIter.getOffset() !== endIter.getOffset()) return;

            const [bufferX, bufferY] = textView.windowToBufferCoords(
                Gtk.TextWindowType.WIDGET,
                Math.trunc(clickX),
                Math.trunc(clickY),
            );
            const [result, iter] = textView.getIterAtPosition(bufferX, bufferY);
            if (!result) return;

            const targetPage = findLinkAtOffset(iter.getOffset());
            if (targetPage !== null) setCurrentPage(targetPage);
        },
        [textViewRef, findLinkAtOffset, setCurrentPage],
    );
}

function useMotionHandler(
    textViewRef: React.RefObject<Gtk.TextView | null>,
    findLinkAtOffset: (offset: number) => number | null,
    hoveringRef: React.RefObject<boolean>,
) {
    return useCallback(
        (motionX: number, motionY: number) => {
            const textView = textViewRef.current;
            if (!textView) return;
            const [bufferX, bufferY] = textView.windowToBufferCoords(
                Gtk.TextWindowType.WIDGET,
                Math.trunc(motionX),
                Math.trunc(motionY),
            );
            const [result, iter] = textView.getIterAtPosition(bufferX, bufferY);
            if (!result) {
                if (hoveringRef.current) {
                    textView.setCursor(Gdk.Cursor.newFromName("text", null));
                    hoveringRef.current = false;
                }
                return;
            }
            const overLink = findLinkAtOffset(iter.getOffset()) !== null;
            if (overLink !== hoveringRef.current) {
                hoveringRef.current = overLink;
                textView.setCursor(Gdk.Cursor.newFromName(overLink ? "pointer" : "text", null));
            }
        },
        [textViewRef, findLinkAtOffset, hoveringRef],
    );
}

function useKeyPressHandler(
    textViewRef: React.RefObject<Gtk.TextView | null>,
    findLinkAtOffset: (offset: number) => number | null,
    setCurrentPage: (page: number) => void,
) {
    return useCallback(
        (keyval: number) => {
            if (keyval !== Gdk.KEY_Return && keyval !== Gdk.KEY_KP_Enter) return false;
            const textView = textViewRef.current;
            if (!textView) return false;
            const buffer = textView.getBuffer();
            const iter = buffer.getIterAtMark(buffer.getInsert());
            const targetPage = findLinkAtOffset(iter.getOffset());
            if (targetPage === null) return false;
            setCurrentPage(targetPage);
            return true;
        },
        [textViewRef, findLinkAtOffset, setCurrentPage],
    );
}

const HypertextDemo = () => {
    const [currentPage, setCurrentPage] = useState(1);
    const textViewRef = useRef<Gtk.TextView | null>(null);

    const getIconPaintable = useCallback((iconName: string, size: number): Gtk.IconPaintable | null => {
        const textView = textViewRef.current;
        if (!textView) return null;
        const display = textView.getDisplay();
        const theme = Gtk.IconTheme.getForDisplay(display);
        return theme.lookupIcon(iconName, null, size, 1, Gtk.TextDirection.LTR, Gtk.IconLookupFlags.PRELOAD);
    }, []);

    const sayWord = useCallback((word: string): void => {
        spawn("espeak-ng", [word], { stdio: "ignore" });
    }, []);

    const { content, linkInfos } = useMemo(
        () => buildPageContent(currentPage, getIconPaintable, sayWord),
        [currentPage, getIconPaintable, sayWord],
    );

    const findLinkAtOffset = useCallback(
        (offset: number): number | null => {
            for (const link of linkInfos) {
                if (offset >= link.start && offset < link.end) return link.targetPage;
            }
            return null;
        },
        [linkInfos],
    );

    const handlers = useHypertextHandlers(textViewRef, findLinkAtOffset, setCurrentPage);

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
                enableUndo
                canFocus
                focusable
            >
                <GtkGestureClick button={1} onReleased={handlers.handleClick} />
                <GtkEventControllerMotion onMotion={handlers.handleMotion} />
                <GtkEventControllerKey onKeyPressed={handlers.handleKeyPress} />
                {content}
            </GtkTextView>
        </GtkScrolledWindow>
    );
};

export const hypertextDemo: Demo = {
    id: "hypertext",
    title: "Text View/Hypertext",
    description:
        "Usually, tags modify the appearance of text in the view, e.g. making it bold or colored or underlined. But tags are not restricted to appearance. They can also affect the behavior of mouse and key presses, as this demo shows.\n\nWe also demonstrate adding other things to a text view, such as clickable icons and widgets which can also replace a character (try copying the ghost text).",
    keywords: ["GtkTextView", "GtkTextBuffer"],
    component: HypertextDemo,
    sourceCode,
    defaultWidth: 330,
    defaultHeight: 330,
    resizable: false,
};
