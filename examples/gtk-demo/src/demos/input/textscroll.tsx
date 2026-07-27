import type * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkScrolledWindow, GtkTextView } from "@gtkx/jsx/gtk";
import { useEffect, useRef } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./textscroll.tsx?raw";

type TickAutoScrollArgs = {
    textView: Gtk.TextView;
    buffer: Gtk.TextBuffer;
    markName: string;
    countRef: React.RefObject<number>;
    scrollToEnd: boolean;
};

const textscrollDemo: Demo = {
    id: "textscroll",
    title: "Text View/Automatic Scrolling",
    description:
        "This example demonstrates how to use the gravity of GtkTextMarks to keep a text view " +
        "scrolled to the bottom while appending text.",
    keywords: ["GtkTextView", "GtkScrolledWindow"],
    component: TextScrollDemo,
    sourceCode,
    defaultWidth: 600,
    defaultHeight: 400,
};

function buildScrollLine(count: number, isScrollToEnd: boolean) {
    const spaces = " ".repeat(count);

    const text = isScrollToEnd
        ? `Scroll to end scroll to end scroll to end scroll to end ${String(count)}`
        : `Scroll to bottom scroll to bottom scroll to bottom scroll to bottom ${String(count)}`;

    return `\n${spaces}${text}`;
}

function scrollMarkOnscreen(
    textView: Gtk.TextView,
    buffer: Gtk.TextBuffer,
    markName: string,
    isScrollToEnd: boolean,
) {
    const mark = buffer.getMark(markName);

    if (!mark) {
        return;
    }

    if (!isScrollToEnd) {
        const endIter = buffer.getEndIter();
        endIter.setLineOffset(0);
        buffer.moveMark(mark, endIter);
    }

    textView.scrollMarkOnscreen(mark);
}

function hasReachedScrollLimit(count: number, isScrollToEnd: boolean) {
    return (isScrollToEnd && count > 150) || (!isScrollToEnd && count > 40);
}

function tickAutoScroll({ textView, buffer, markName, countRef, scrollToEnd }: TickAutoScrollArgs) {
    const count = ++countRef.current;
    const iter = buffer.getEndIter();
    buffer.insert(iter, buildScrollLine(count, scrollToEnd), -1);
    scrollMarkOnscreen(textView, buffer, markName, scrollToEnd);

    if (hasReachedScrollLimit(count, scrollToEnd)) {
        countRef.current = 0;
    }
}

function startAutoScroll(
    textView: Gtk.TextView | null,
    countRef: React.RefObject<number>,
    isScrollToEnd: boolean,
) {
    if (!textView) {
        return;
    }

    const buffer = textView.getBuffer();
    const markName = isScrollToEnd ? "end" : "scroll";
    buffer.createMark(markName, buffer.getEndIter(), isScrollToEnd);

    const timeoutId = setInterval(
        () => {
            tickAutoScroll({ textView, buffer, markName, countRef, scrollToEnd: isScrollToEnd });
        },
        isScrollToEnd ? 50 : 100,
    );

    return () => {
        clearInterval(timeoutId);
    };
}

function AutoScrollTextView({ scrollToEnd }: { scrollToEnd: boolean }) {
    const textViewRef = useRef<Gtk.TextView | null>(null);
    const countRef = useRef(0);
    useEffect(() => startAutoScroll(textViewRef.current, countRef, scrollToEnd), [scrollToEnd]);

    return (
        <GtkScrolledWindow hexpand>
            <GtkTextView ref={textViewRef} name={scrollToEnd ? "text-view-end" : "text-view-scroll"} />
        </GtkScrolledWindow>
    );
}

function TextScrollDemo() {
    return (
        <GtkBox homogeneous spacing={6}>
            <AutoScrollTextView scrollToEnd />
            <AutoScrollTextView scrollToEnd={false} />
        </GtkBox>
    );
}

export { textscrollDemo };
