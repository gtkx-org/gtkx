import * as Gtk from "@gtkx/gi/gtk";
import * as Pango from "@gtkx/gi/pango";
import { GtkScrolledWindow, GtkTextBuffer, GtkTextView } from "@gtkx/jsx/gtk";
import type { Demo } from "../types.js";
import sourceCode from "./tabs.tsx?raw";

const TabsDemo = () => {
    const tabs = (() => {
        const t = Pango.TabArray.new(3, true);
        t.setTab(0, Pango.TabAlign.LEFT, 0);
        t.setTab(1, Pango.TabAlign.DECIMAL, 150);
        t.setDecimalPoint(1, ".");
        t.setTab(2, Pango.TabAlign.RIGHT, 290);
        return t;
    })();

    return (
        <GtkScrolledWindow
            name="scrolled"
            hscrollbarPolicy={Gtk.PolicyType.NEVER}
            vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
        >
            <GtkTextView
                wrapMode={Gtk.WrapMode.WORD}
                topMargin={20}
                bottomMargin={20}
                leftMargin={20}
                rightMargin={20}
                tabs={tabs}
                buffer={<GtkTextBuffer>{"one\t2.0\tthree\nfour\t5.555\tsix\nseven\t88.88\tnine"}</GtkTextBuffer>}
            />
        </GtkScrolledWindow>
    );
};

export const tabsDemo: Demo = {
    id: "tabs",
    title: "Text View/Tabs",
    description:
        "GtkTextView can position text at fixed positions, using tabs. Tabs can specify alignment, and also allow aligning numbers on the decimal point.\n\nThe example here has three tabs, with left, numeric and right alignment.",
    keywords: [],
    component: TabsDemo,
    sourceCode,
    defaultWidth: 330,
    defaultHeight: 130,
    resizable: false,
};
