import * as Gtk from "@gtkx/ffi/gtk";
import * as Pango from "@gtkx/ffi/pango";
import { GtkButton, GtkDropDown, GtkEntry, GtkPaned, GtkScale, GtkScrolledWindow, GtkTextView, x } from "@gtkx/react";
import { useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./textview.tsx?raw";

const INITIAL_CONTENT = `The text widget can display text with all kinds of nifty attributes. It also supports multiple views of the same buffer; this demo is showing the same buffer in two places.

Font styles. For example, you can have italic, bold, or monospace (typewriter) text.

Colors. Colors such as a blue foreground or a red background can be used.

Underline, strikethrough. Strikethrough, underline are all supported.

You can put widgets in the buffer: Here's a button: \uFFFC and a menu: \uFFFC and a scale: \uFFFC and a text entry: \uFFFC.

This demo doesn't demonstrate all the GtkTextBuffer features; it leaves out, for example: invisible/hidden text, tab stops, application-drawn areas on the sides of the widget for displaying breakpoints and such...`;

const FormattedTextBuffer = ({ text, onTextChanged }: { text: string; onTextChanged: (text: string) => void }) => (
    <x.TextBuffer text={text} onTextChanged={onTextChanged}>
        <x.TextTag id="heading1" start={186} end={199} weight={Pango.Weight.BOLD} scale={1.2} />
        <x.TextTag id="italic" start={224} end={230} style={Pango.Style.ITALIC} />
        <x.TextTag id="bold" start={232} end={236} weight={Pango.Weight.BOLD} />
        <x.TextTag id="monospace" start={242} end={264} family="monospace" />
        <x.TextTag id="heading2" start={273} end={281} weight={Pango.Weight.BOLD} scale={1.2} />
        <x.TextTag id="blue" start={297} end={314} foreground="blue" />
        <x.TextTag id="red" start={318} end={334} background="red" />
        <x.TextTag id="heading3" start={350} end={374} weight={Pango.Weight.BOLD} scale={1.2} />
        <x.TextTag id="strike" start={375} end={388} strikethrough />
        <x.TextTag id="underline" start={390} end={399} underline={Pango.Underline.SINGLE} />
        <x.TextAnchor index={0}>
            <GtkButton label="Click Me" />
        </x.TextAnchor>
        <x.TextAnchor index={1}>
            <GtkDropDown>
                <x.SimpleListItem id="1" value="Option 1" />
                <x.SimpleListItem id="2" value="Option 2" />
                <x.SimpleListItem id="3" value="Option 3" />
            </GtkDropDown>
        </x.TextAnchor>
        <x.TextAnchor index={2}>
            <GtkScale orientation={Gtk.Orientation.HORIZONTAL} widthRequest={100}>
                <x.Adjustment value={50} lower={0} upper={100} stepIncrement={1} pageIncrement={10} />
            </GtkScale>
        </x.TextAnchor>
        <x.TextAnchor index={3}>
            <GtkEntry widthChars={10} />
        </x.TextAnchor>
    </x.TextBuffer>
);

const TextViewDemo = () => {
    const [text, setText] = useState(INITIAL_CONTENT);

    return (
        <GtkPaned orientation={Gtk.Orientation.VERTICAL} shrinkStartChild shrinkEndChild>
            <GtkScrolledWindow hscrollbarPolicy={Gtk.PolicyType.AUTOMATIC} vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}>
                <GtkTextView>
                    <FormattedTextBuffer text={text} onTextChanged={setText} />
                </GtkTextView>
            </GtkScrolledWindow>
            <GtkScrolledWindow hscrollbarPolicy={Gtk.PolicyType.AUTOMATIC} vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}>
                <GtkTextView>
                    <FormattedTextBuffer text={text} onTextChanged={setText} />
                </GtkTextView>
            </GtkScrolledWindow>
        </GtkPaned>
    );
};

export const textviewDemo: Demo = {
    id: "textview",
    title: "Text View/Multiple Views",
    description:
        "The GtkTextView widget displays a GtkTextBuffer. One GtkTextBuffer can be displayed by multiple GtkTextViews. This demo has two views displaying a single buffer, and shows off the widget's text formatting features.",
    keywords: ["textview", "text", "buffer", "GtkTextView", "GtkTextBuffer", "tag", "formatting", "widget", "embed"],
    component: TextViewDemo,
    sourceCode,
};
