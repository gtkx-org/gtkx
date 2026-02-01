import * as Gdk from "@gtkx/ffi/gdk";
import * as Gtk from "@gtkx/ffi/gtk";
import * as Pango from "@gtkx/ffi/pango";
import { GtkButton, GtkDropDown, GtkEntry, GtkPaned, GtkScale, GtkScrolledWindow, GtkTextView, x } from "@gtkx/react";
import { useMemo } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./textview.tsx?raw";

const SCALE_XX_SMALL = 0.5787037037037;
const SCALE_X_LARGE = 1.44;

const FormattedTextBuffer = ({ onButtonClick }: { onButtonClick?: () => void }) => {
    const iconPaintable = useMemo(() => {
        const display = Gdk.Display.getDefault();
        if (!display) return null;
        const iconTheme = Gtk.IconTheme.getForDisplay(display);
        return iconTheme.lookupIcon("drive-harddisk", 32, 1, Gtk.TextDirection.NONE, 0);
    }, []);

    return (
        <>
            The text widget can display text with all kinds of nifty attributes. It also supports multiple views of the
            same buffer; this demo is showing the same buffer in two places.
            {"\n\n"}
            <x.TextTag id="heading" weight={Pango.Weight.BOLD} size={15 * Pango.SCALE}>
                Font styles.
            </x.TextTag>
            {" For example, you can have "}
            <x.TextTag id="italic" style={Pango.Style.ITALIC}>
                italic
            </x.TextTag>
            {", "}
            <x.TextTag id="bold" weight={Pango.Weight.BOLD}>
                bold
            </x.TextTag>
            {", or "}
            <x.TextTag id="monospace" family="monospace">
                monospace (typewriter)
            </x.TextTag>
            {", or "}
            <x.TextTag id="big" size={20 * Pango.SCALE}>
                big
            </x.TextTag>
            {" text. It's best not to hardcode specific text sizes; you can use relative sizes as with CSS, such as "}
            <x.TextTag id="xx-small" scale={SCALE_XX_SMALL}>
                xx-small
            </x.TextTag>
            {" or "}
            <x.TextTag id="x-large" scale={SCALE_X_LARGE}>
                x-large
            </x.TextTag>
            {" to ensure that your program properly adapts if the user changes the default font size.\n\n"}
            <x.TextTag id="heading2" weight={Pango.Weight.BOLD} size={15 * Pango.SCALE}>
                Colors.
            </x.TextTag>
            {" Colors such as "}
            <x.TextTag id="blue_foreground" foreground="blue">
                a blue foreground
            </x.TextTag>
            {" or "}
            <x.TextTag id="red_background" background="red">
                a red background
            </x.TextTag>
            {" or even "}
            <x.TextTag id="blue_on_red" foreground="blue" background="red">
                a blue foreground on red background
            </x.TextTag>
            {" (select that to read it) can be used.\n\n"}
            <x.TextTag id="heading3" weight={Pango.Weight.BOLD} size={15 * Pango.SCALE}>
                Underline, strikethrough, and rise.
            </x.TextTag>{" "}
            <x.TextTag id="strikethrough" strikethrough>
                Strikethrough
            </x.TextTag>
            {", "}
            <x.TextTag id="underline" underline={Pango.Underline.SINGLE}>
                underline
            </x.TextTag>
            {", "}
            <x.TextTag id="double_underline" underline={Pango.Underline.DOUBLE}>
                double underline
            </x.TextTag>
            {", "}
            <x.TextTag id="superscript" rise={10 * Pango.SCALE} size={8 * Pango.SCALE}>
                superscript
            </x.TextTag>
            {", and "}
            <x.TextTag id="subscript" rise={-10 * Pango.SCALE} size={8 * Pango.SCALE}>
                subscript
            </x.TextTag>
            {" are all supported.\n\n"}
            <x.TextTag id="heading4" weight={Pango.Weight.BOLD} size={15 * Pango.SCALE}>
                Images.
            </x.TextTag>
            {" The buffer can have images in it: "}
            {iconPaintable && <x.TextPaintable paintable={iconPaintable} />}
            {" for example.\n\n"}
            <x.TextTag id="heading5" weight={Pango.Weight.BOLD} size={15 * Pango.SCALE}>
                Spacing.
            </x.TextTag>
            {" You can adjust the amount of space before each line.\n"}
            <x.TextTag id="big_gap_before" pixelsAboveLines={30} leftMargin={50} rightMargin={50}>
                This line has a whole lot of space before it.
            </x.TextTag>
            {"\n"}
            <x.TextTag id="big_gap_after" pixelsBelowLines={30} leftMargin={50} rightMargin={50}>
                You can also adjust the amount of space after each line; this line has a whole lot of space after it.
            </x.TextTag>
            {"\n"}
            <x.TextTag
                id="double_spaced"
                pixelsInsideWrap={10}
                leftMargin={50}
                rightMargin={50}
                wrapMode={Gtk.WrapMode.WORD}
            >
                You can also adjust the amount of space between wrapped lines; this line has extra space between each
                wrapped line in the same paragraph. To show off wrapping, some filler text: the quick brown fox jumped
                over the lazy dog. Blah blah blah blah blah blah blah blah blah.
            </x.TextTag>
            {"\nAlso note that those lines have extra-wide margins.\n\n"}
            <x.TextTag id="heading6" weight={Pango.Weight.BOLD} size={15 * Pango.SCALE}>
                Editability.
            </x.TextTag>{" "}
            <x.TextTag id="not_editable" editable={false}>
                This line is 'locked down' and can't be edited by the user - just try it! You can't delete this line.
            </x.TextTag>
            {"\n\n"}
            <x.TextTag id="heading7" weight={Pango.Weight.BOLD} size={15 * Pango.SCALE}>
                Wrapping.
            </x.TextTag>{" "}
            <x.TextTag id="word_wrap" wrapMode={Gtk.WrapMode.WORD}>
                This line (and most of the others in this buffer) is word-wrapped, using the proper Unicode algorithm.
                Word wrap should work in all scripts and languages that GTK supports. Let's make this a long paragraph
                to demonstrate: blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah
                blah blah
            </x.TextTag>
            {"\n\n"}
            <x.TextTag id="char_wrap" wrapMode={Gtk.WrapMode.CHAR}>
                This line has character-based wrapping, and can wrap between any two character glyphs. Let's make this a
                long paragraph to demonstrate: blah blah blah blah blah blah blah blah blah blah blah blah blah blah
                blah blah blah blah blah
            </x.TextTag>
            {"\n\n"}
            <x.TextTag id="no_wrap" wrapMode={Gtk.WrapMode.NONE}>
                This line has all wrapping turned off, so it makes the horizontal scrollbar appear.
            </x.TextTag>
            {"\n\n\n"}
            <x.TextTag id="heading8" weight={Pango.Weight.BOLD} size={15 * Pango.SCALE}>
                Justification.
            </x.TextTag>
            {"\n"}
            <x.TextTag id="center" justification={Gtk.Justification.CENTER}>
                This line has center justification.
            </x.TextTag>
            {"\n"}
            <x.TextTag id="right_justify" justification={Gtk.Justification.RIGHT}>
                This line has right justification.
            </x.TextTag>
            {"\n\n"}
            <x.TextTag id="wide_margins" leftMargin={50} rightMargin={50}>
                This line has big wide margins. Text text text text text text text text text text text text text text
                text text text text text text text text text text text text text text text text text text text text
                text.
            </x.TextTag>
            {"\n\n"}
            <x.TextTag id="heading9" weight={Pango.Weight.BOLD} size={15 * Pango.SCALE}>
                Internationalization.
            </x.TextTag>
            {
                " You can put all sorts of Unicode text in the buffer.\n\nGerman (Deutsch Süd) Grüß Gott\nGreek (Ελληνικά) Γειά σας\nHebrew שלום\nJapanese (日本語)\n\nThe widget properly handles bidirectional text, word wrapping, DOS/UNIX/Unicode paragraph separators, grapheme boundaries, and so on using the Pango internationalization framework.\n"
            }
            {"Here's a word-wrapped quote in a right-to-left language:\n"}
            <x.TextTag
                id="rtl_quote"
                wrapMode={Gtk.WrapMode.WORD}
                direction={Gtk.TextDirection.RTL}
                indent={30}
                leftMargin={20}
                rightMargin={20}
            >
                وقد بدأ ثلاث من أكثر المؤسسات تقدما في شبكة اكسيون برامجها كمنظمات لا تسعى للربح، ثم تحولت في السنوات
                الخمس الماضية إلى مؤسسات مالية منظمة، وباتت جزءا من النظام المالي في بلدانها، ولكنها تتخصص في خدمة قطاع
                المشروعات الصغيرة. وأحد أكثر هذه المؤسسات نجاحا هو «بانكوسول» في بوليفيا.
            </x.TextTag>
            {"\n\nYou can put widgets in the buffer: Here's a button: "}
            <x.TextAnchor>
                <GtkButton label="Click Me" onClicked={onButtonClick} />
            </x.TextAnchor>
            {" and a menu: "}
            <x.TextAnchor>
                <GtkDropDown>
                    <x.ListItem id="1" value="Option 1" />
                    <x.ListItem id="2" value="Option 2" />
                    <x.ListItem id="3" value="Option 3" />
                </GtkDropDown>
            </x.TextAnchor>
            {" and a scale: "}
            <x.TextAnchor>
                <GtkScale
                    orientation={Gtk.Orientation.HORIZONTAL}
                    widthRequest={100}
                    value={50}
                    lower={0}
                    upper={100}
                    stepIncrement={1}
                    pageIncrement={10}
                />
            </x.TextAnchor>
            {" finally a text entry: "}
            <x.TextAnchor>
                <GtkEntry widthChars={10} />
            </x.TextAnchor>
            {
                ".\n\nThis demo doesn't demonstrate all the GtkTextBuffer features; it leaves out, for example: invisible/hidden text, tab stops, application-drawn areas on the sides of the widget for displaying breakpoints and such..."
            }
        </>
    );
};

const TextViewDemo = () => (
    <GtkPaned orientation={Gtk.Orientation.VERTICAL} shrinkStartChild shrinkEndChild>
        <x.Slot for={GtkPaned} id="startChild">
            <GtkScrolledWindow hscrollbarPolicy={Gtk.PolicyType.AUTOMATIC} vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}>
                <GtkTextView wrapMode={Gtk.WrapMode.WORD}>
                    <FormattedTextBuffer />
                </GtkTextView>
            </GtkScrolledWindow>
        </x.Slot>
        <x.Slot for={GtkPaned} id="endChild">
            <GtkScrolledWindow hscrollbarPolicy={Gtk.PolicyType.AUTOMATIC} vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}>
                <GtkTextView wrapMode={Gtk.WrapMode.WORD}>
                    <FormattedTextBuffer />
                </GtkTextView>
            </GtkScrolledWindow>
        </x.Slot>
    </GtkPaned>
);

export const textviewDemo: Demo = {
    id: "textview",
    title: "Text View/Multiple Views",
    description:
        "The GtkTextView widget displays a GtkTextBuffer. One GtkTextBuffer can be displayed by multiple GtkTextViews. This demo has two views displaying a single buffer, and shows off the widget's text formatting features.",
    keywords: ["textview", "text", "buffer", "GtkTextView", "GtkTextBuffer", "tag", "formatting", "widget", "embed"],
    component: TextViewDemo,
    sourceCode,
};
