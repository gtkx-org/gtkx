import { Context, Format, ImageSurface } from "@gtkx/ffi/cairo";
import * as Gdk from "@gtkx/ffi/gdk";
import * as GLib from "@gtkx/ffi/glib";
import * as Gtk from "@gtkx/ffi/gtk";
import * as Pango from "@gtkx/ffi/pango";
import { GtkButton, GtkDropDown, GtkEntry, GtkPaned, GtkScale, GtkScrolledWindow, GtkTextView, x } from "@gtkx/react";
import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./textview.tsx?raw";

const SCALE_XX_SMALL = 0.5787037037037;
const SCALE_X_LARGE = 1.44;

const headingProps = { weight: Pango.Weight.BOLD, size: 15 * Pango.SCALE } as const;

function createNuclearTexture(): Gdk.Texture {
    const size = 32;
    const surface = new ImageSurface(Format.ARGB32, size, size);
    const cr = new Context(surface);

    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 2;

    cr.setLineWidth(1.5);
    cr.setSourceRgba(0, 0, 0, 1);

    cr.arc(cx, cy, r * 0.15, 0, 2 * Math.PI);
    cr.fill();

    for (let i = 0; i < 3; i++) {
        const orbAngle = (i * 2 * Math.PI) / 3;
        cr.save();
        cr.translate(cx, cy);
        cr.rotate(orbAngle);
        cr.scale(1, 0.35);
        cr.newPath();
        cr.arc(0, 0, r * 0.85, 0, 2 * Math.PI);
        cr.restore();
        cr.stroke();
    }

    const pixelData = surface.getData();
    const stride = surface.getStride();
    const bytes = new GLib.Bytes(pixelData.length, [...pixelData]);
    const builder = new Gdk.MemoryTextureBuilder();
    builder.setBytes(bytes);
    builder.setWidth(size);
    builder.setHeight(size);
    builder.setStride(stride);
    builder.setFormat(Gdk.MemoryFormat.B8G8R8A8_PREMULTIPLIED);
    return builder.build();
}

function findChildAnchors(buffer: Gtk.TextBuffer): Gtk.TextChildAnchor[] {
    const anchors: Gtk.TextChildAnchor[] = [];
    const iter = new Gtk.TextIter();
    buffer.getStartIter(iter);
    do {
        const anchor = iter.getChildAnchor();
        if (anchor) anchors.push(anchor);
    } while (iter.forwardChar());
    return anchors;
}

function attachWidgetClones(view: Gtk.TextView, anchors: Gtk.TextChildAnchor[], onClickMe?: () => void) {
    if (anchors[0]) {
        const btn = new Gtk.Button();
        btn.setLabel("Click Me");
        if (onClickMe) btn.connect("clicked", onClickMe);
        view.addChildAtAnchor(btn, anchors[0]);
    }

    if (anchors[1]) {
        const dd = Gtk.DropDown.newFromStrings(["Option 1", "Option 2", "Option 3"]);
        view.addChildAtAnchor(dd, anchors[1]);
    }

    if (anchors[2]) {
        const adj = new Gtk.Adjustment(0, 0, 100, 1, 10, 0);
        const scale = new Gtk.Scale(Gtk.Orientation.HORIZONTAL, adj);
        scale.setSizeRequest(100, -1);
        view.addChildAtAnchor(scale, anchors[2]);
    }

    if (anchors[3]) {
        const entry = new Gtk.Entry();
        entry.setWidthChars(10);
        view.addChildAtAnchor(entry, anchors[3]);
    }
}

let easterEggWindow: Gtk.Window | null = null;

function recursiveAttachView(depth: number, view: Gtk.TextView, anchor: Gtk.TextChildAnchor) {
    if (depth > 4) return;

    const childView = new Gtk.TextView();
    childView.setBuffer(view.getBuffer());
    childView.setSizeRequest(260 - 20 * depth, -1);

    const frame = new Gtk.Frame();
    frame.setChild(childView);

    view.addChildAtAnchor(frame, anchor);

    recursiveAttachView(depth + 1, childView, anchor);
}

function handleEasterEgg(sourceView: Gtk.TextView) {
    if (easterEggWindow) {
        easterEggWindow.present();
        return;
    }

    const buffer = new Gtk.TextBuffer();
    const iter = new Gtk.TextIter();
    buffer.getStartIter(iter);
    buffer.insert(iter, "This buffer is shared by a set of nested text views.\n Nested view:\n", -1);
    const anchor = buffer.createChildAnchor(iter);
    buffer.insert(iter, "\nDon't do this in real applications, please.\n", -1);

    const view = new Gtk.TextView();
    view.setBuffer(buffer);
    view.setWrapMode(Gtk.WrapMode.WORD);

    recursiveAttachView(0, view, anchor);

    const win = new Gtk.Window();
    easterEggWindow = win;

    const root = sourceView.getRoot();
    if (root instanceof Gtk.Window) {
        win.setTransientFor(root);
        win.setModal(true);
    }

    win.connect("close-request", () => {
        easterEggWindow = null;
        return false;
    });

    const sw = new Gtk.ScrolledWindow();
    sw.setChild(view);
    win.setChild(sw);
    win.setDefaultSize(300, 400);
    win.present();
}

const TextViewDemo = () => {
    const textView1Ref = useRef<Gtk.TextView | null>(null);
    const textView2Ref = useRef<Gtk.TextView | null>(null);

    const handleClickMe = useCallback(() => {
        const tv = textView1Ref.current;
        if (tv) handleEasterEgg(tv);
    }, []);

    const iconPaintable = useMemo(() => {
        const display = Gdk.Display.getDefault();
        if (!display) return null;
        const iconTheme = Gtk.IconTheme.getForDisplay(display);
        return iconTheme.lookupIcon("drive-harddisk", 32, 1, Gtk.TextDirection.NONE, 0);
    }, []);

    const nuclearPaintable = useMemo(() => createNuclearTexture(), []);

    useLayoutEffect(() => {
        const tv1 = textView1Ref.current;
        const tv2 = textView2Ref.current;
        if (!tv1 || !tv2) return;

        const buffer = tv1.getBuffer();
        tv2.setBuffer(buffer);

        const anchors = findChildAnchors(buffer);
        attachWidgetClones(tv2, anchors, () => {
            if (textView2Ref.current) handleEasterEgg(textView2Ref.current);
        });

        return () => {
            if (easterEggWindow) {
                easterEggWindow.destroy();
                easterEggWindow = null;
            }
        };
    }, []);

    return (
        <GtkPaned orientation={Gtk.Orientation.VERTICAL} resizeStartChild={false} resizeEndChild>
            <x.Slot for={GtkPaned} id="startChild">
                <GtkScrolledWindow
                    hscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
                    vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
                >
                    <GtkTextView ref={textView1Ref} wrapMode={Gtk.WrapMode.WORD}>
                        {
                            "The text widget can display text with all kinds of nifty attributes. It also supports multiple views of the same buffer; this demo is showing the same buffer in two places.\n\n"
                        }

                        <x.TextTag id="heading-font" {...headingProps}>
                            {"Font styles. "}
                        </x.TextTag>
                        {"For example, you can have "}
                        <x.TextTag id="italic" style={Pango.Style.ITALIC}>
                            italic
                        </x.TextTag>
                        {", "}
                        <x.TextTag id="bold" weight={Pango.Weight.BOLD}>
                            bold
                        </x.TextTag>
                        {", or "}
                        <x.TextTag id="monospace" family="monospace">
                            {"monospace (typewriter)"}
                        </x.TextTag>
                        {", or "}
                        <x.TextTag id="big" size={20 * Pango.SCALE}>
                            big
                        </x.TextTag>
                        {
                            " text. It's best not to hardcode specific text sizes; you can use relative sizes as with CSS, such as "
                        }
                        <x.TextTag id="xx-small" scale={SCALE_XX_SMALL}>
                            xx-small
                        </x.TextTag>
                        {" or "}
                        <x.TextTag id="x-large" scale={SCALE_X_LARGE}>
                            x-large
                        </x.TextTag>
                        {" to ensure that your program properly adapts if the user changes the default font size.\n\n"}

                        <x.TextTag id="heading-colors" {...headingProps}>
                            {"Colors. "}
                        </x.TextTag>
                        {"Colors such as "}
                        <x.TextTag id="blue_foreground" foreground="blue">
                            {"a blue foreground"}
                        </x.TextTag>
                        {" or "}
                        <x.TextTag id="red_background" background="red">
                            {"a red background"}
                        </x.TextTag>
                        {" or even "}
                        <x.TextTag id="blue_fg" foreground="blue">
                            <x.TextTag id="red_bg" background="red">
                                {"a blue foreground on red background"}
                            </x.TextTag>
                        </x.TextTag>
                        {" (select that to read it) can be used.\n\n"}

                        <x.TextTag id="heading-underline" {...headingProps}>
                            {"Underline, strikethrough, and rise. "}
                        </x.TextTag>
                        <x.TextTag id="strikethrough" strikethrough>
                            Strikethrough
                        </x.TextTag>
                        {", "}
                        <x.TextTag id="underline" underline={Pango.Underline.SINGLE}>
                            underline
                        </x.TextTag>
                        {", "}
                        <x.TextTag id="double_underline" underline={Pango.Underline.DOUBLE}>
                            {"double underline"}
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

                        <x.TextTag id="heading-images" {...headingProps}>
                            {"Images. "}
                        </x.TextTag>
                        {"The buffer can have images in it: "}
                        {iconPaintable && <x.TextPaintable paintable={iconPaintable} />}
                        <x.TextPaintable paintable={nuclearPaintable} />
                        {" for example.\n\n"}

                        <x.TextTag id="heading-spacing" {...headingProps}>
                            {"Spacing. "}
                        </x.TextTag>
                        {"You can adjust the amount of space before each line.\n"}
                        <x.TextTag id="wide_margins_1" leftMargin={50} rightMargin={50}>
                            <x.TextTag id="big_gap_before" pixelsAboveLines={30}>
                                {"This line has a whole lot of space before it."}
                            </x.TextTag>
                        </x.TextTag>
                        {"\n"}
                        <x.TextTag id="wide_margins_2" leftMargin={50} rightMargin={50}>
                            <x.TextTag id="big_gap_after" pixelsBelowLines={30}>
                                {
                                    "You can also adjust the amount of space after each line; this line has a whole lot of space after it."
                                }
                            </x.TextTag>
                        </x.TextTag>
                        {"\n"}
                        <x.TextTag id="wide_margins_3" leftMargin={50} rightMargin={50}>
                            <x.TextTag id="double_spaced" pixelsInsideWrap={10}>
                                {
                                    "You can also adjust the amount of space between wrapped lines; this line has extra space between each wrapped line in the same paragraph. To show off wrapping, some filler text: the quick brown fox jumped over the lazy dog. Blah blah blah blah blah blah blah blah blah."
                                }
                            </x.TextTag>
                        </x.TextTag>
                        {"\nAlso note that those lines have extra-wide margins.\n\n"}

                        <x.TextTag id="heading-edit" {...headingProps}>
                            {"Editability. "}
                        </x.TextTag>
                        <x.TextTag id="not_editable" editable={false}>
                            {
                                "This line is 'locked down' and can't be edited by the user - just try it! You can't delete this line."
                            }
                        </x.TextTag>
                        {"\n\n"}

                        <x.TextTag id="heading-wrap" {...headingProps}>
                            {"Wrapping. "}
                        </x.TextTag>
                        <x.TextTag id="word_wrap" wrapMode={Gtk.WrapMode.WORD}>
                            {
                                "This line (and most of the others in this buffer) is word-wrapped, using the proper Unicode algorithm. Word wrap should work in all scripts and languages that GTK supports. Let's make this a long paragraph to demonstrate: blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah"
                            }
                        </x.TextTag>
                        {"\n\n"}
                        <x.TextTag id="char_wrap" wrapMode={Gtk.WrapMode.CHAR}>
                            {
                                "This line has character-based wrapping, and can wrap between any two character glyphs. Let's make this a long paragraph to demonstrate: blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah"
                            }
                        </x.TextTag>
                        {"\n\n"}
                        <x.TextTag id="no_wrap" wrapMode={Gtk.WrapMode.NONE}>
                            {"This line has all wrapping turned off, so it makes the horizontal scrollbar appear."}
                        </x.TextTag>
                        {"\n\n\n"}

                        <x.TextTag id="heading-justify" {...headingProps}>
                            {"Justification. "}
                        </x.TextTag>
                        {"\n"}
                        <x.TextTag id="center" justification={Gtk.Justification.CENTER}>
                            {"This line has center justification."}
                        </x.TextTag>
                        {"\n"}
                        <x.TextTag id="right_justify" justification={Gtk.Justification.RIGHT}>
                            {"This line has right justification."}
                        </x.TextTag>
                        {"\n\n"}
                        <x.TextTag id="wide_margins" leftMargin={50} rightMargin={50}>
                            {
                                "This line has big wide margins. Text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text."
                            }
                        </x.TextTag>
                        {"\n\n"}

                        <x.TextTag id="heading-intl" {...headingProps}>
                            {"Internationalization. "}
                        </x.TextTag>
                        {
                            " You can put all sorts of Unicode text in the buffer.\n\nGerman (Deutsch S\u00fcd) Gr\u00fc\u00df Gott\nGreek (\u0395\u03bb\u03bb\u03b7\u03bd\u03b9\u03ba\u03ac) \u0393\u03b5\u03b9\u03ac \u03c3\u03b1\u03c2\nHebrew \u05e9\u05dc\u05d5\u05dd\nJapanese (\u65e5\u672c\u8a9e)\n\nThe widget properly handles bidirectional text, word wrapping, DOS/UNIX/Unicode paragraph separators, grapheme boundaries, and so on using the Pango internationalization framework.\n"
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
                            {
                                "\u0648\u0642\u062f \u0628\u062f\u0623 \u062b\u0644\u0627\u062b \u0645\u0646 \u0623\u0643\u062b\u0631 \u0627\u0644\u0645\u0624\u0633\u0633\u0627\u062a \u062a\u0642\u062f\u0645\u0627 \u0641\u064a \u0634\u0628\u0643\u0629 \u0627\u0643\u0633\u064a\u0648\u0646 \u0628\u0631\u0627\u0645\u062c\u0647\u0627 \u0643\u0645\u0646\u0638\u0645\u0627\u062a \u0644\u0627 \u062a\u0633\u0639\u0649 \u0644\u0644\u0631\u0628\u062d\u060c \u062b\u0645 \u062a\u062d\u0648\u0644\u062a \u0641\u064a \u0627\u0644\u0633\u0646\u0648\u0627\u062a \u0627\u0644\u062e\u0645\u0633 \u0627\u0644\u0645\u0627\u0636\u064a\u0629 \u0625\u0644\u0649 \u0645\u0624\u0633\u0633\u0627\u062a \u0645\u0627\u0644\u064a\u0629 \u0645\u0646\u0638\u0645\u0629\u060c \u0648\u0628\u0627\u062a\u062a \u062c\u0632\u0621\u0627 \u0645\u0646 \u0627\u0644\u0646\u0638\u0627\u0645 \u0627\u0644\u0645\u0627\u0644\u064a \u0641\u064a \u0628\u0644\u062f\u0627\u0646\u0647\u0627\u060c \u0648\u0644\u0643\u0646\u0647\u0627 \u062a\u062a\u062e\u0635\u0635 \u0641\u064a \u062e\u062f\u0645\u0629 \u0642\u0637\u0627\u0639 \u0627\u0644\u0645\u0634\u0631\u0648\u0639\u0627\u062a \u0627\u0644\u0635\u063a\u064a\u0631\u0629. \u0648\u0623\u062d\u062f \u0623\u0643\u062b\u0631 \u0647\u0630\u0647 \u0627\u0644\u0645\u0624\u0633\u0633\u0627\u062a \u0646\u062c\u0627\u062d\u0627 \u0647\u0648 \u00ab\u0628\u0627\u0646\u0643\u0648\u0633\u0648\u0644\u00bb \u0641\u064a \u0628\u0648\u0644\u064a\u0641\u064a\u0627."
                            }
                        </x.TextTag>

                        {"\n\nYou can put widgets in the buffer: Here's a button: "}
                        <x.TextAnchor>
                            <GtkButton label="Click Me" onClicked={handleClickMe} />
                        </x.TextAnchor>
                        {" and a menu: "}
                        <x.TextAnchor>
                            <GtkDropDown>
                                <x.ListItem key="opt1" id="opt1" value="Option 1" />
                                <x.ListItem key="opt2" id="opt2" value="Option 2" />
                                <x.ListItem key="opt3" id="opt3" value="Option 3" />
                            </GtkDropDown>
                        </x.TextAnchor>
                        {" and a scale: "}
                        <x.TextAnchor>
                            <GtkScale
                                orientation={Gtk.Orientation.HORIZONTAL}
                                lower={0}
                                upper={100}
                                stepIncrement={1}
                                pageIncrement={10}
                                widthRequest={100}
                            />
                        </x.TextAnchor>
                        {" finally a text entry: "}
                        <x.TextAnchor>
                            <GtkEntry widthChars={10} />
                        </x.TextAnchor>
                        {
                            ".\n\nThis demo doesn't demonstrate all the GtkTextBuffer features; it leaves out, for example: invisible/hidden text, tab stops, application-drawn areas on the sides of the widget for displaying breakpoints and such..."
                        }
                    </GtkTextView>
                </GtkScrolledWindow>
            </x.Slot>
            <x.Slot for={GtkPaned} id="endChild">
                <GtkScrolledWindow
                    hscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
                    vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
                >
                    <GtkTextView ref={textView2Ref} wrapMode={Gtk.WrapMode.WORD} />
                </GtkScrolledWindow>
            </x.Slot>
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
    defaultWidth: 450,
    defaultHeight: 450,
};
