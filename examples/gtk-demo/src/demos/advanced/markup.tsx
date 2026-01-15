import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkLabel, GtkScrolledWindow, GtkStack, GtkStackSwitcher, GtkTextView, x } from "@gtkx/react";
import { useEffect, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./markup.tsx?raw";

const SAMPLE_MARKUP = `<big>Welcome to <b>Pango Markup</b></big>

This demonstrates how <span foreground="red">Pango markup</span> can be used to style text.

<b>Bold</b>, <i>italic</i>, <u>underline</u>, and <s>strikethrough</s> are easy.

You can use <tt>monospace</tt> for code, <sub>subscripts</sub> and <sup>superscripts</sup>.

<span foreground="#3584e4" size="large">Colors and sizes</span> work too.

<span background="yellow" foreground="black"> Highlighting </span> is also possible.

<span font_family="serif">Different</span> <span font_family="sans">font</span> <span font_family="monospace">families</span>

Visit <a href="https://docs.gtk.org/Pango/pango_markup.html">Pango Documentation</a> for more.`;

const MarkupDemo = () => {
    const formattedViewRef = useRef<Gtk.TextView | null>(null);
    const sourceViewRef = useRef<Gtk.TextView | null>(null);
    const [stack, setStack] = useState<Gtk.Stack | null>(null);

    useEffect(() => {
        const formattedView = formattedViewRef.current;
        const sourceView = sourceViewRef.current;

        if (sourceView) {
            const buffer = sourceView.getBuffer();
            if (buffer) {
                buffer.setText(SAMPLE_MARKUP, -1);
            }
        }

        if (formattedView) {
            const buffer = formattedView.getBuffer();
            if (buffer) {
                const startIter = new Gtk.TextIter();
                buffer.getStartIter(startIter);
                buffer.insertMarkup(startIter, SAMPLE_MARKUP, -1);
            }
        }
    }, []);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={0} vexpand hexpand>
            <GtkStackSwitcher stack={stack ?? undefined} halign={Gtk.Align.CENTER} marginTop={12} marginBottom={12} />
            <GtkStack ref={setStack} vexpand hexpand transitionType={Gtk.StackTransitionType.CROSSFADE}>
                <x.StackPage id="formatted" title="Formatted">
                    <GtkScrolledWindow vexpand hexpand>
                        <GtkTextView
                            ref={formattedViewRef}
                            editable={false}
                            cursorVisible={false}
                            wrapMode={Gtk.WrapMode.WORD}
                            topMargin={12}
                            bottomMargin={12}
                            leftMargin={12}
                            rightMargin={12}
                        />
                    </GtkScrolledWindow>
                </x.StackPage>
                <x.StackPage id="source" title="Source">
                    <GtkScrolledWindow vexpand hexpand>
                        <GtkTextView
                            ref={sourceViewRef}
                            editable={false}
                            cursorVisible={false}
                            wrapMode={Gtk.WrapMode.WORD}
                            monospace
                            topMargin={12}
                            bottomMargin={12}
                            leftMargin={12}
                            rightMargin={12}
                        />
                    </GtkScrolledWindow>
                </x.StackPage>
            </GtkStack>
            <GtkLabel
                label="Use the tabs above to switch between formatted view and source markup"
                cssClasses={["dim-label"]}
                marginTop={12}
                marginBottom={12}
            />
        </GtkBox>
    );
};

export const markupDemo: Demo = {
    id: "markup",
    title: "Text View/Markup",
    description: "Rich text formatting with Pango markup",
    keywords: ["pango", "markup", "text", "formatting", "rich text", "html", "label", "styled"],
    component: MarkupDemo,
    sourceCode,
};
