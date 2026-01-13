import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkEntry, GtkFrame, GtkLabel, GtkScrolledWindow } from "@gtkx/react";
import { useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./markup.tsx?raw";

interface MarkupExample {
    name: string;
    markup: string;
    description: string;
}

const markupExamples: MarkupExample[] = [
    {
        name: "Bold & Italic",
        markup: "<b>Bold text</b> and <i>italic text</i>",
        description: "Basic text styling with <b> and <i> tags",
    },
    {
        name: "Underline & Strikethrough",
        markup: "<u>Underlined</u> and <s>strikethrough</s>",
        description: "Text decoration with <u> and <s> tags",
    },
    {
        name: "Subscript & Superscript",
        markup: "H<sub>2</sub>O and E=mc<sup>2</sup>",
        description: "Scientific notation with <sub> and <sup>",
    },
    {
        name: "Monospace",
        markup: "Regular text and <tt>monospace code</tt>",
        description: "Fixed-width font with <tt> tag",
    },
    {
        name: "Font Size",
        markup: '<span size="small">Small</span> Normal <span size="large">Large</span> <span size="x-large">X-Large</span>',
        description: "Size variants using span size attribute",
    },
    {
        name: "Colors",
        markup: '<span foreground="red">Red</span> <span foreground="#3584e4">Blue</span> <span foreground="green">Green</span>',
        description: "Text colors with foreground attribute",
    },
    {
        name: "Background",
        markup: '<span background="yellow" foreground="black"> Highlighted </span>',
        description: "Background color for highlighting",
    },
    {
        name: "Font Family",
        markup: '<span font_family="serif">Serif</span> <span font_family="sans">Sans</span> <span font_family="monospace">Mono</span>',
        description: "Different font families",
    },
    {
        name: "Font Weight",
        markup: '<span weight="light">Light</span> <span weight="normal">Normal</span> <span weight="bold">Bold</span> <span weight="ultrabold">Ultra Bold</span>',
        description: "Font weight variations",
    },
    {
        name: "Letter Spacing",
        markup: '<span letter_spacing="5000">S P A C E D</span> <span letter_spacing="0">Tight</span>',
        description: "Letter spacing in Pango units (1024 = 1pt)",
    },
    {
        name: "Combined",
        markup: '<span foreground="#9141ac" size="large"><b><i>Purple Bold Italic</i></b></span>',
        description: "Combining multiple attributes",
    },
    {
        name: "Links",
        markup: 'Visit <a href="https://gtk.org">GTK Website</a>',
        description: "Hyperlinks with <a> tag",
    },
];

const MarkupDemo = () => {
    const [customMarkup, setCustomMarkup] = useState("<b>Hello</b> <i>World</i>");
    const [showPreview, setShowPreview] = useState(true);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={24}>
            <GtkLabel label="Pango Markup" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="Pango markup is a simple XML-like format for styling text in GTK labels. It supports rich formatting including colors, sizes, fonts, and text decorations."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkFrame label="Try Your Own Markup">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel label="Enter Pango markup below:" halign={Gtk.Align.START} />
                    <GtkEntry
                        text={customMarkup}
                        onChanged={(entry: Gtk.Entry) => setCustomMarkup(entry.getText())}
                        hexpand
                        placeholderText="Enter markup like <b>bold</b> or <i>italic</i>"
                    />
                    <GtkBox spacing={8}>
                        <GtkButton
                            label={showPreview ? "Hide Preview" : "Show Preview"}
                            onClicked={() => setShowPreview(!showPreview)}
                        />
                        <GtkButton
                            label="Reset"
                            onClicked={() => setCustomMarkup("<b>Hello</b> <i>World</i>")}
                            cssClasses={["destructive-action"]}
                        />
                    </GtkBox>
                    {showPreview && (
                        <GtkBox orientation={Gtk.Orientation.VERTICAL} cssClasses={["card"]} marginTop={8}>
                            <GtkLabel
                                label="Preview:"
                                cssClasses={["dim-label"]}
                                halign={Gtk.Align.START}
                                marginTop={8}
                                marginStart={12}
                            />
                            <GtkLabel
                                label={customMarkup}
                                useMarkup
                                wrap
                                halign={Gtk.Align.START}
                                marginTop={8}
                                marginBottom={12}
                                marginStart={12}
                                marginEnd={12}
                            />
                        </GtkBox>
                    )}
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Markup Examples">
                <GtkScrolledWindow heightRequest={350} hscrollbarPolicy={Gtk.PolicyType.NEVER}>
                    <GtkBox
                        orientation={Gtk.Orientation.VERTICAL}
                        spacing={16}
                        marginTop={12}
                        marginBottom={12}
                        marginStart={12}
                        marginEnd={12}
                    >
                        {markupExamples.map((example) => (
                            <GtkBox
                                key={example.name}
                                orientation={Gtk.Orientation.VERTICAL}
                                spacing={4}
                                cssClasses={["card"]}
                                marginStart={4}
                                marginEnd={4}
                            >
                                <GtkBox spacing={8} marginTop={8} marginStart={12} marginEnd={12}>
                                    <GtkLabel label={example.name} cssClasses={["heading"]} halign={Gtk.Align.START} />
                                </GtkBox>
                                <GtkLabel
                                    label={example.description}
                                    cssClasses={["dim-label"]}
                                    halign={Gtk.Align.START}
                                    marginStart={12}
                                />
                                <GtkBox
                                    orientation={Gtk.Orientation.VERTICAL}
                                    spacing={4}
                                    marginTop={8}
                                    marginBottom={8}
                                    marginStart={12}
                                    marginEnd={12}
                                >
                                    <GtkLabel
                                        label="Markup:"
                                        cssClasses={["dim-label", "caption"]}
                                        halign={Gtk.Align.START}
                                    />
                                    <GtkLabel
                                        label={example.markup}
                                        cssClasses={["monospace"]}
                                        halign={Gtk.Align.START}
                                        wrap
                                    />
                                    <GtkLabel
                                        label="Result:"
                                        cssClasses={["dim-label", "caption"]}
                                        halign={Gtk.Align.START}
                                        marginTop={8}
                                    />
                                    <GtkLabel label={example.markup} useMarkup halign={Gtk.Align.START} wrap />
                                </GtkBox>
                            </GtkBox>
                        ))}
                    </GtkBox>
                </GtkScrolledWindow>
            </GtkFrame>

            <GtkFrame label="Quick Reference">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={8}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel label="Common Tags:" cssClasses={["heading"]} halign={Gtk.Align.START} />
                    <GtkLabel
                        label="<b>bold</b> <i>italic</i> <u>underline</u> <s>strikethrough</s> <tt>monospace</tt> <sub>subscript</sub> <sup>superscript</sup>"
                        useMarkup
                        wrap
                        halign={Gtk.Align.START}
                    />
                    <GtkLabel
                        label="Span Attributes:"
                        cssClasses={["heading"]}
                        halign={Gtk.Align.START}
                        marginTop={12}
                    />
                    <GtkLabel
                        label="foreground, background, size, weight, font_family, font_desc, style, variant, stretch, letter_spacing, rise, strikethrough, underline"
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["monospace", "dim-label"]}
                    />
                </GtkBox>
            </GtkFrame>
        </GtkBox>
    );
};

export const markupDemo: Demo = {
    id: "markup",
    title: "Pango Markup",
    description: "Rich text formatting with Pango markup",
    keywords: ["pango", "markup", "text", "formatting", "rich text", "html", "label", "styled"],
    component: MarkupDemo,
    sourceCode,
};
