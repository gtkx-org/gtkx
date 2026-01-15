import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkScrolledWindow, GtkTextView } from "@gtkx/react";
import { useEffect, useRef } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./textscroll.tsx?raw";

const AutoScrollTextView = ({ scrollToEnd }: { scrollToEnd: boolean }) => {
    const textViewRef = useRef<Gtk.TextView | null>(null);
    const countRef = useRef(0);

    useEffect(() => {
        const textView = textViewRef.current;
        if (!textView) return;

        const buffer = textView.getBuffer();
        if (!buffer) return;

        const markName = scrollToEnd ? "end" : "scroll";
        const endIter = new Gtk.TextIter();
        buffer.getEndIter(endIter);
        buffer.createMark(endIter, !scrollToEnd, markName);

        const timeoutId = setInterval(
            () => {
                const count = ++countRef.current;
                const spaces = " ".repeat(count);
                const text = scrollToEnd
                    ? `Scroll to end scroll to end scroll to end scroll to end ${count}`
                    : `Scroll to bottom scroll to bottom scroll to bottom scroll to bottom ${count}`;

                const iter = new Gtk.TextIter();
                buffer.getEndIter(iter);
                buffer.insert(iter, `\n${spaces}${text}`, -1);

                const mark = buffer.getMark(markName);
                if (mark) {
                    if (!scrollToEnd) {
                        const scrollIter = new Gtk.TextIter();
                        buffer.getEndIter(scrollIter);
                        scrollIter.setLineOffset(0);
                        buffer.moveMark(mark, scrollIter);
                    }
                    textView.scrollMarkOnscreen(mark);
                }

                if (scrollToEnd && count > 150) {
                    countRef.current = 0;
                } else if (!scrollToEnd && count > 40) {
                    countRef.current = 0;
                }
            },
            scrollToEnd ? 50 : 100,
        );

        return () => clearInterval(timeoutId);
    }, [scrollToEnd]);

    return (
        <GtkScrolledWindow hexpand>
            <GtkTextView ref={textViewRef} />
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
    keywords: ["scroll", "textview", "GtkTextMark", "GtkScrolledWindow", "automatic"],
    component: TextScrollDemo,
    sourceCode,
};
