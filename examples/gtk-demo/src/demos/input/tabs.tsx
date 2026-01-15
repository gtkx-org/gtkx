import * as Gtk from "@gtkx/ffi/gtk";
import * as Pango from "@gtkx/ffi/pango";
import { GtkScrolledWindow, GtkTextView, x } from "@gtkx/react";
import { useEffect, useRef } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./tabs.tsx?raw";

const TabsDemo = () => {
    const textViewRef = useRef<Gtk.TextView>(null);

    useEffect(() => {
        const view = textViewRef.current;
        if (!view) return;

        const tabs = new Pango.TabArray(3, true);
        tabs.setTab(0, Pango.TabAlign.LEFT, 0);
        tabs.setTab(1, Pango.TabAlign.DECIMAL, 150);
        tabs.setDecimalPoint(1, ".".charCodeAt(0));
        tabs.setTab(2, Pango.TabAlign.RIGHT, 290);
        view.setTabs(tabs);
    }, []);

    return (
        <GtkScrolledWindow hscrollbarPolicy={Gtk.PolicyType.NEVER} vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}>
            <GtkTextView
                ref={textViewRef}
                wrapMode={Gtk.WrapMode.WORD}
                topMargin={20}
                bottomMargin={20}
                leftMargin={20}
                rightMargin={20}
            >
                <x.TextBuffer text={"one\t2.0\tthree\nfour\t5.555\tsix\nseven\t88.88\tnine"} />
            </GtkTextView>
        </GtkScrolledWindow>
    );
};

export const tabsDemo: Demo = {
    id: "tabs",
    title: "Text View/Tabs",
    description:
        "GtkTextView can position text at fixed positions, using tabs. Tabs can specify alignment, and also allow aligning numbers on the decimal point. The example here has three tabs, with left, numeric and right alignment.",
    keywords: ["tabs", "textview", "pango", "alignment", "decimal", "PangoTabArray", "GtkTextView"],
    component: TabsDemo,
    sourceCode,
};
