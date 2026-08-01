import type { ReactNode } from "react";
import * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";
import * as Pango from "@gtkx/gi/pango";
import {
    GtkEventControllerKey,
    GtkEventControllerMotion,
    GtkGestureClick,
    GtkImage,
    GtkLevelBar,
    GtkScrolledWindow,
    GtkTextBuffer,
    GtkTextChildAnchor,
    GtkTextMark,
    GtkTextTag,
    GtkTextView,
} from "@gtkx/jsx/gtk";
import { spawn } from "node:child_process";
import { accessSync, constants } from "node:fs";
import { delimiter, join } from "node:path";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Demo } from "../types.js";
import { lookupIconPaintable } from "../icon-paintable.js";
import sourceCode from "./hypertext.tsx?raw";

type LinkInfo = {
    id: string;
    targetPage: number;
    start: number;
    end: number;
};

type PageBuilder = {
    nodes: ReactNode[];
    links: LinkInfo[];
    offset: number;
    skipText: (text: string) => void;
    skipPlaceholder: () => void;
    addText: (text: string) => void;
    addNode: (node: ReactNode) => void;
    addLink: (id: string, text: string, targetPage: number) => void;
};

type PageContent = {
    content: ReactNode;
    linkInfos: LinkInfo[];
};

type DefinitionPageArgs = {
    title: string;
    phonetic: string;
    definition: string;
};

type GhostAnchorArgs = {
    mark: Gtk.TextMark;
    buffer: Gtk.TextBuffer;
    view: Gtk.TextView;
    label: Gtk.Label;
    anchor: Gtk.TextChildAnchor;
};

type LinkClickArgs = {
    textView: Gtk.TextView | null;
    clickX: number;
    clickY: number;
    findLink: (offset: number) => number | null;
    setCurrentPage: (page: number) => void;
};

type LinkMotionArgs = {
    textView: Gtk.TextView | null;
    motionX: number;
    motionY: number;
    findLink: (offset: number) => number | null;
    hoveringRef: React.RefObject<boolean>;
};

type LinkKeyPressArgs = {
    keyval: number;
    textView: Gtk.TextView | null;
    findLink: (offset: number) => number | null;
    setCurrentPage: (page: number) => void;
};

const hypertextDemo: Demo = {
    id: "hypertext",
    title: "Text View/Hypertext",
    description:
        "Usually, tags modify the appearance of text in the view, e.g. making it bold or colored or " +
        "underlined. But tags are not restricted to appearance. They can also affect the behavior of " +
        "mouse and key presses, as this demo shows.\n\nWe also demonstrate adding other things to a " +
        "text view, such as clickable icons and widgets which can also replace a character " +
        "(try copying the ghost text).",
    keywords: ["GtkTextView", "GtkTextBuffer"],
    component: HypertextDemo,
    sourceCode,
    defaultWidth: 330,
    defaultHeight: 330,
    isResizable: false,
};

function isExecutable(path: string): boolean {
    try {
        accessSync(path, constants.X_OK);

        return true;
    } catch {
        return false;
    }
}

function resolveExecutable(command: string): string {
    const searchPaths = (process.env.PATH ?? "").split(delimiter).filter((entry) => entry.length > 0);

    for (const directory of searchPaths) {
        const candidate = join(directory, command);

        if (isExecutable(candidate)) {
            return candidate;
        }
    }

    return command;
}

function sayWord(word: string): void {
    spawn(resolveExecutable("espeak-ng"), [word], { stdio: "ignore" });
}

function InlineIcon({ iconName, size }: { iconName: string; size: number }) {
    const paintable = useMemo(() => lookupIconPaintable(iconName, size), [iconName, size]);

    return paintable ? <GtkTextChildAnchor paintable={paintable} /> : null;
}

function removeGhostAnchor({ mark, buffer, view, label, anchor }: GhostAnchorArgs) {
    if (label.getParent() === view) {
        view.remove(label);
    }

    if (mark.getBuffer() !== buffer || anchor.getDeleted()) {
        return;
    }

    const start = buffer.getIterAtChildAnchor(anchor);
    const end = buffer.getIterAtChildAnchor(anchor);
    end.forwardChar();
    buffer.delete(start, end);
}

function attachGhostAnchor(mark: Gtk.TextMark | null, view: Gtk.TextView | null) {
    const buffer = mark?.getBuffer();

    if (!mark || !buffer || !view) {
        return;
    }

    const anchor = Gtk.TextChildAnchor.newWithReplacement("👻");
    buffer.insertChildAnchor(buffer.getIterAtMark(mark), anchor);
    const label = new Gtk.Label({ label: "ghost" });
    view.addChildAtAnchor(label, anchor);

    return () => {
        removeGhostAnchor({ mark, buffer, view, label, anchor });
    };
}

function GhostLabelAnchor({ viewRef }: { viewRef: React.RefObject<Gtk.TextView | null> }) {
    const markRef = useRef<Gtk.TextMark | null>(null);
    useEffect(() => attachGhostAnchor(markRef.current, viewRef.current), [viewRef]);

    return <GtkTextMark leftGravity ref={markRef} />;
}

function createPageBuilder(): PageBuilder {
    const nodes: ReactNode[] = [];
    const links: LinkInfo[] = [];

    const builder: PageBuilder = {
        nodes,
        links,
        offset: 0,
        skipText: (text: string) => {
            builder.offset += text.length;
        },
        skipPlaceholder: () => {
            builder.offset += 1;
        },
        addText: (text: string) => {
            builder.offset += text.length;
            nodes.push(text);
        },
        addNode: (node: ReactNode) => {
            nodes.push(node);
        },
        addLink: (id: string, text: string, targetPage: number) => {
            links.push({ id, targetPage, start: builder.offset, end: builder.offset + text.length });
            builder.offset += text.length;
        },
    };

    return builder;
}

function buildPage1(ghostAnchor: ReactNode): PageContent {
    const b = createPageBuilder();
    b.addText("Some text to show that simple ");
    b.addLink("hypertext", "hypertext", 3);

    b.addNode(
        <GtkTextTag key="link-hypertext" name="link-hypertext" foreground="blue" underline={Pango.Underline.SINGLE}>
            hypertext
        </GtkTextTag>,
    );

    b.addText(" can easily be realized with ");
    b.addLink("tags", "tags", 2);

    b.addNode(
        <GtkTextTag key="link-tags" name="link-tags" foreground="blue" underline={Pango.Underline.SINGLE}>
            tags
        </GtkTextTag>,
    );

    b.addText(".\nOf course you can also embed Emoji 😋, ");
    b.addText("icons ");
    b.skipPlaceholder();
    b.addNode(<InlineIcon key="icon" iconName="view-conceal-symbolic" size={16} />);
    b.addText(", or even widgets ");
    b.skipPlaceholder();

    b.addNode(
        <GtkTextChildAnchor key="levelbar">
            <GtkLevelBar value={50} minValue={0} maxValue={100} widthRequest={100} />
        </GtkTextChildAnchor>,
    );

    b.addText(" and labels with ");
    b.skipPlaceholder();
    b.addNode(ghostAnchor);
    b.addText(" text.");

    return { content: b.nodes, linkInfos: b.links };
}

function buildDefinitionPage({ title, phonetic, definition }: DefinitionPageArgs): PageContent {
    const b = createPageBuilder();
    b.skipText(title);
    b.skipText(" /");
    b.skipText(" ");
    b.skipText(phonetic);
    b.skipText(" /");
    b.skipText(" ");
    b.skipPlaceholder();

    b.addNode(
        <GtkTextTag key="nobreaks" name="nobreaks" allowBreaks={false}>
            <GtkTextTag key="title" name="title" weight={Pango.Weight.BOLD} scale={1.44}>
                {title}
            </GtkTextTag>
            {" / "}
            <GtkTextTag key="phonetic" name="phonetic" family="monospace">
                {phonetic}
            </GtkTextTag>
            {" / "}
            <GtkTextChildAnchor key="speaker">
                <GtkImage
                    iconName="audio-volume-high-symbolic"
                    cursor={Gdk.Cursor.newFromName("pointer", null)}
                    controllers={(
                        <GtkGestureClick onPressed={() => {
                            sayWord(title);
                        }}
                        />
                    )}
                />
            </GtkTextChildAnchor>
        </GtkTextTag>,
    );

    b.addText(definition);
    b.addLink("goback", "Go back", 1);

    b.addNode(
        <GtkTextTag key="link-goback" name="link-goback" foreground="blue" underline={Pango.Underline.SINGLE}>
            Go back
        </GtkTextTag>,
    );

    return { content: b.nodes, linkInfos: b.links };
}

function buildPage2(): PageContent {
    return buildDefinitionPage({
        title: "tag",
        phonetic: "tag",
        definition:
            "\n\nAn attribute that can be applied to some range of text. For example, a tag might be " +
            "called \"bold\" and make the text inside the tag bold.\n\nHowever, the tag concept is " +
            "more general than that; tags don't have to affect appearance. They can instead affect " +
            "the behavior of mouse and key presses, \"lock\" a range of text so the user can't edit " +
            "it, or countless other things.\n",
    });
}

function buildPage3(): PageContent {
    return buildDefinitionPage({
        title: "hypertext",
        phonetic: "ˈhaɪ pərˌtɛkst",
        definition:
            "\n\nMachine-readable text that is not sequential but is organized so that related items " +
            "of information are connected.\n",
    });
}

function buildPageContent(currentPage: number, ghostAnchor: ReactNode): PageContent {
    if (currentPage === 1) {
        return buildPage1(ghostAnchor);
    }

    if (currentPage === 2) {
        return buildPage2();
    }

    if (currentPage === 3) {
        return buildPage3();
    }

    return { content: null, linkInfos: [] };
}

function findLinkAtOffset(linkInfos: LinkInfo[], offset: number): number | null {
    for (const link of linkInfos) {
        if (offset >= link.start && offset < link.end) {
            return link.targetPage;
        }
    }

    return null;
}

function handleLinkClick({ textView, clickX, clickY, findLink, setCurrentPage }: LinkClickArgs) {
    if (!textView) {
        return;
    }

    const buffer = textView.getBuffer();
    const [, startIter, endIter] = buffer.getSelectionBounds();

    if (startIter.getOffset() !== endIter.getOffset()) {
        return;
    }

    const [bufferX, bufferY] = textView.windowToBufferCoords(
        Gtk.TextWindowType.WIDGET,
        Math.trunc(clickX),
        Math.trunc(clickY),
    );

    const [result, iter] = textView.getIterAtPosition(bufferX, bufferY);

    if (!result) {
        return;
    }

    const targetPage = findLink(iter.getOffset());

    if (targetPage !== null) {
        setCurrentPage(targetPage);
    }
}

function setHoverCursor(textView: Gtk.TextView, hoveringRef: React.RefObject<boolean>, isOverLink: boolean) {
    if (isOverLink === hoveringRef.current) {
        return;
    }

    hoveringRef.current = isOverLink;
    textView.setCursor(Gdk.Cursor.newFromName(isOverLink ? "pointer" : "text", null));
}

function handleLinkMotion({ textView, motionX, motionY, findLink, hoveringRef }: LinkMotionArgs) {
    if (!textView) {
        return;
    }

    const [bufferX, bufferY] = textView.windowToBufferCoords(
        Gtk.TextWindowType.WIDGET,
        Math.trunc(motionX),
        Math.trunc(motionY),
    );

    const [result, iter] = textView.getIterAtPosition(bufferX, bufferY);

    if (!result) {
        setHoverCursor(textView, hoveringRef, false);

        return;
    }

    setHoverCursor(textView, hoveringRef, findLink(iter.getOffset()) !== null);
}

function handleLinkKeyPress({ keyval, textView, findLink, setCurrentPage }: LinkKeyPressArgs) {
    if (keyval !== Gdk.KEY_Return && keyval !== Gdk.KEY_KP_Enter) {
        return Gdk.EVENT_PROPAGATE;
    }

    if (!textView) {
        return Gdk.EVENT_PROPAGATE;
    }

    const buffer = textView.getBuffer();
    const iter = buffer.getIterAtMark(buffer.getInsert());
    const targetPage = findLink(iter.getOffset());

    if (targetPage === null) {
        return Gdk.EVENT_PROPAGATE;
    }

    setCurrentPage(targetPage);

    return Gdk.EVENT_STOP;
}

function useKeyPressHandler(
    textViewRef: React.RefObject<Gtk.TextView | null>,
    findLink: (offset: number) => number | null,
    setCurrentPage: (page: number) => void,
) {
    return (keyval: number) =>
        handleLinkKeyPress({ keyval, textView: textViewRef.current, findLink, setCurrentPage });
}

function useHypertextHandlers(
    textViewRef: React.RefObject<Gtk.TextView | null>,
    findLink: (offset: number) => number | null,
    setCurrentPage: (page: number) => void,
) {
    const hoveringRef = useRef(false);
    const handleKeyPress = useKeyPressHandler(textViewRef, findLink, setCurrentPage);

    const handleClick = (_nPress: number, clickX: number, clickY: number) => {
        handleLinkClick({ textView: textViewRef.current, clickX, clickY, findLink, setCurrentPage });
    };

    const handleMotion = (motionX: number, motionY: number) => {
        handleLinkMotion({ textView: textViewRef.current, motionX, motionY, findLink, hoveringRef });
    };

    return { handleClick, handleMotion, handleKeyPress };
}

function HypertextDemo() {
    const [currentPage, setCurrentPage] = useState(1);
    const textViewRef = useRef<Gtk.TextView | null>(null);
    const ghostAnchor = <GhostLabelAnchor key="ghost-anchor" viewRef={textViewRef} />;
    const { content, linkInfos } = buildPageContent(currentPage, ghostAnchor);
    const findLink = (offset: number) => findLinkAtOffset(linkInfos, offset);
    const handlers = useHypertextHandlers(textViewRef, findLink, setCurrentPage);

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
                canFocus
                focusable
                controllers={(
                    <>
                        <GtkGestureClick button={1} onReleased={handlers.handleClick} />
                        <GtkEventControllerMotion onMotion={handlers.handleMotion} />
                        <GtkEventControllerKey onKeyPressed={handlers.handleKeyPress} />
                    </>
                )}
                buffer={<GtkTextBuffer enableUndo>{content}</GtkTextBuffer>}
            />
        </GtkScrolledWindow>
    );
}

export { hypertextDemo };
