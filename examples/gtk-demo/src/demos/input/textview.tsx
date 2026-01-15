import * as Gtk from "@gtkx/ffi/gtk";
import * as Pango from "@gtkx/ffi/pango";
import { GtkButton, GtkDropDown, GtkEntry, GtkPaned, GtkScale, GtkScrolledWindow, GtkTextView, x } from "@gtkx/react";
import type { Demo } from "../types.js";
import sourceCode from "./textview.tsx?raw";

const FormattedTextBuffer = ({ viewId }: { viewId: string }) => (
    <x.TextBuffer>
        The text widget can display text with all kinds of nifty attributes. It also supports multiple views of the same
        buffer; this demo is showing the same buffer in two places.{"\n\n"}
        <x.TextTag id={`heading1-${viewId}`} weight={Pango.Weight.BOLD} scale={1.2}>
            Font styles.
        </x.TextTag>
        {" For example, you can have "}
        <x.TextTag id={`italic-${viewId}`} style={Pango.Style.ITALIC}>
            italic
        </x.TextTag>
        {", "}
        <x.TextTag id={`bold-${viewId}`} weight={Pango.Weight.BOLD}>
            bold
        </x.TextTag>
        {", or "}
        <x.TextTag id={`monospace-${viewId}`} family="monospace">
            monospace (typewriter)
        </x.TextTag>
        {" text.\n\n"}
        <x.TextTag id={`heading2-${viewId}`} weight={Pango.Weight.BOLD} scale={1.2}>
            Colors.
        </x.TextTag>
        {" Colors such as a "}
        <x.TextTag id={`blue-${viewId}`} foreground="blue">
            blue foreground
        </x.TextTag>
        {" or a "}
        <x.TextTag id={`red-${viewId}`} background="red">
            red background
        </x.TextTag>
        {" can be used.\n\n"}
        <x.TextTag id={`heading3-${viewId}`} weight={Pango.Weight.BOLD} scale={1.2}>
            Underline, strikethrough.
        </x.TextTag>{" "}
        <x.TextTag id={`strike-${viewId}`} strikethrough>
            Strikethrough
        </x.TextTag>
        {", "}
        <x.TextTag id={`underline-${viewId}`} underline={Pango.Underline.SINGLE}>
            underline
        </x.TextTag>
        {" are all supported.\n\nYou can put widgets in the buffer: Here's a button: "}
        <x.TextAnchor>
            <GtkButton label="Click Me" />
        </x.TextAnchor>
        {" and a menu: "}
        <x.TextAnchor>
            <GtkDropDown>
                <x.SimpleListItem id="1" value="Option 1" />
                <x.SimpleListItem id="2" value="Option 2" />
                <x.SimpleListItem id="3" value="Option 3" />
            </GtkDropDown>
        </x.TextAnchor>
        {" and a scale: "}
        <x.TextAnchor>
            <GtkScale orientation={Gtk.Orientation.HORIZONTAL} widthRequest={100}>
                <x.Adjustment value={50} lower={0} upper={100} stepIncrement={1} pageIncrement={10} />
            </GtkScale>
        </x.TextAnchor>
        {" and a text entry: "}
        <x.TextAnchor>
            <GtkEntry widthChars={10} />
        </x.TextAnchor>
        {
            ".\n\nThis demo doesn't demonstrate all the GtkTextBuffer features; it leaves out, for example: invisible/hidden text, tab stops, application-drawn areas on the sides of the widget for displaying breakpoints and such..."
        }
    </x.TextBuffer>
);

const TextViewDemo = () => {
    return (
        <GtkPaned orientation={Gtk.Orientation.VERTICAL} shrinkStartChild shrinkEndChild>
            <GtkScrolledWindow hscrollbarPolicy={Gtk.PolicyType.AUTOMATIC} vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}>
                <GtkTextView>
                    <FormattedTextBuffer viewId="top" />
                </GtkTextView>
            </GtkScrolledWindow>
            <GtkScrolledWindow hscrollbarPolicy={Gtk.PolicyType.AUTOMATIC} vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}>
                <GtkTextView>
                    <FormattedTextBuffer viewId="bottom" />
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
