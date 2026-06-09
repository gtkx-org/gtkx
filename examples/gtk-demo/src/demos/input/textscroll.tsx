import type * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkScrolledWindow, GtkTextView } from "@gtkx/jsx/gtk";
import { useEffect, useRef } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./textscroll.tsx?raw";

interface TickAutoScrollArgs {
    textView: Gtk.TextView;
    buffer: Gtk.TextBuffer;
    markName: string;
    countRef: React.RefObject<number>;
    scrollToEnd: boolean;
}

const tickAutoScroll = ({ textView, buffer, markName, countRef, scrollToEnd }: TickAutoScrollArgs) => {
    const count = ++countRef.current;
    const spaces = " ".repeat(count);
    const text = scrollToEnd
        ? `Scroll to end scroll to end scroll to end scroll to end ${count}`
        : `Scroll to bottom scroll to bottom scroll to bottom scroll to bottom ${count}`;

    const iter = buffer.getEndIter();
    buffer.insert(iter, `\n${spaces}${text}`, -1);

    const mark = buffer.getMark(markName);
    if (mark) {
        if (!scrollToEnd) {
            const endIter = buffer.getEndIter();
            endIter.setLineOffset(0);
            buffer.moveMark(mark, endIter);
        }
        textView.scrollMarkOnscreen(mark);
    }

    if ((scrollToEnd && count > 150) || (!scrollToEnd && count > 40)) {
        countRef.current = 0;
    }
};

const AutoScrollTextView = ({ scrollToEnd }: { scrollToEnd: boolean }) => {
    const textViewRef = useRef<Gtk.TextView | null>(null);
    const countRef = useRef(0);

    useEffect(() => {
        const textView = textViewRef.current;
        if (!textView) return;
        const buffer = textView.getBuffer();
        if (!buffer) return;

        const markName = scrollToEnd ? "end" : "scroll";
        buffer.createMark(markName, buffer.getEndIter(), scrollToEnd);

        const timeoutId = setInterval(
            () => tickAutoScroll({ textView, buffer, markName, countRef, scrollToEnd }),
            scrollToEnd ? 50 : 100,
        );

        return () => clearInterval(timeoutId);
    }, [scrollToEnd]);

    return (
        <GtkScrolledWindow hexpand>
            <GtkTextView ref={textViewRef} name={scrollToEnd ? "text-view-end" : "text-view-scroll"} />
        </GtkScrolledWindow>
    );
};

const TextScrollDemo = () => {
    return (
        <GtkBox homogeneous spacing={6}>
            <AutoScrollTextView scrollToEnd />
            <AutoScrollTextView scrollToEnd={false} />
        </GtkBox>
    );
};

export const textscrollDemo: Demo = {
    id: "textscroll",
    title: "Text View/Automatic Scrolling",
    description:
        "This example demonstrates how to use the gravity of GtkTextMarks to keep a text view scrolled to the bottom while appending text.",
    keywords: ["GtkTextView", "GtkScrolledWindow"],
    component: TextScrollDemo,
    sourceCode,
    defaultWidth: 600,
    defaultHeight: 400,
};
