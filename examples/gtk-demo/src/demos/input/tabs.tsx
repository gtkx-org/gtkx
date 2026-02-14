import * as Gtk from "@gtkx/ffi/gtk";
import * as Pango from "@gtkx/ffi/pango";
import { GtkScrolledWindow, GtkTextView } from "@gtkx/react";
import { useMemo } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./tabs.tsx?raw";

const TabsDemo = () => {
    const tabs = useMemo(() => {
        const t = new Pango.TabArray(3, true);
        t.setTab(0, Pango.TabAlign.LEFT, 0);
        t.setTab(1, Pango.TabAlign.DECIMAL, 150);
        t.setDecimalPoint(1, ".".charCodeAt(0));
        t.setTab(2, Pango.TabAlign.RIGHT, 290);
        return t;
    }, []);

    return (
        <GtkScrolledWindow hscrollbarPolicy={Gtk.PolicyType.NEVER} vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}>
            <GtkTextView
                wrapMode={Gtk.WrapMode.WORD}
                topMargin={20}
                bottomMargin={20}
                leftMargin={20}
                rightMargin={20}
                tabs={tabs}
            >
                {"one\t2.0\tthree\nfour\t5.555\tsix\nseven\t88.88\tnine"}
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
    defaultWidth: 330,
    defaultHeight: 130,
};
