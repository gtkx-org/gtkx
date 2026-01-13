import * as Gtk from "@gtkx/ffi/gtk";
import * as Pango from "@gtkx/ffi/pango";
import { GtkBox, GtkFrame, GtkLabel, GtkScrolledWindow, GtkTextView } from "@gtkx/react";
import { useEffect, useMemo, useRef } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./tabs.tsx?raw";

const TabsDemo = () => {
    const textViewRef = useRef<Gtk.TextView>(null);

    const buffer = useMemo(() => {
        const buf = new Gtk.TextBuffer();
        buf.setText("one\t2.0\tthree\nfour\t5.555\tsix\nseven\t88.88\tnine", -1);
        return buf;
    }, []);

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
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={24}>
            <GtkLabel label="Text View/Tabs" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="GtkTextView can position text at fixed positions, using tabs. Tabs can specify alignment, and also allow aligning numbers on the decimal point."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkFrame label="Tab Alignment Example">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={8}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="The example below has three tabs: left-aligned at 0px, decimal-aligned at 150px, and right-aligned at 290px."
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />
                    <GtkScrolledWindow hscrollbarPolicy={Gtk.PolicyType.NEVER} vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}>
                        <GtkTextView
                            ref={textViewRef}
                            buffer={buffer}
                            wrapMode={Gtk.WrapMode.WORD}
                            topMargin={20}
                            bottomMargin={20}
                            leftMargin={20}
                            rightMargin={20}
                            editable={false}
                            cursorVisible={false}
                        />
                    </GtkScrolledWindow>
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Tab Types">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={8}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel label="LEFT" cssClasses={["heading"]} halign={Gtk.Align.START} />
                    <GtkLabel
                        label="Text appears to the right of the tab stop position (default alignment)."
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />

                    <GtkLabel label="RIGHT" cssClasses={["heading"]} halign={Gtk.Align.START} marginTop={8} />
                    <GtkLabel
                        label="Text appears to the left of the tab stop position."
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />

                    <GtkLabel label="CENTER" cssClasses={["heading"]} halign={Gtk.Align.START} marginTop={8} />
                    <GtkLabel
                        label="Text is centered at the tab stop position."
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />

                    <GtkLabel label="DECIMAL" cssClasses={["heading"]} halign={Gtk.Align.START} marginTop={8} />
                    <GtkLabel
                        label="Text before the decimal point appears to the left of the tab stop, the rest to the right. Useful for aligning numbers in tables."
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="API Usage">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={8}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label={`// Create tab array with positions in pixels
const tabs = new Pango.TabArray(3, true);
tabs.setTab(0, Pango.TabAlign.LEFT, 0);
tabs.setTab(1, Pango.TabAlign.DECIMAL, 150);
tabs.setDecimalPoint(1, '.'.charCodeAt(0));
tabs.setTab(2, Pango.TabAlign.RIGHT, 290);
textView.setTabs(tabs);`}
                        halign={Gtk.Align.START}
                        cssClasses={["monospace"]}
                    />
                </GtkBox>
            </GtkFrame>
        </GtkBox>
    );
};

export const tabsDemo: Demo = {
    id: "tabs",
    title: "Text View/Tabs",
    description: "GtkTextView can position text at fixed positions using tabs.",
    keywords: ["tabs", "textview", "pango", "alignment", "decimal", "PangoTabArray", "GtkTextView"],
    component: TabsDemo,
    sourceCode,
};
