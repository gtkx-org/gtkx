import { Context, Format, ImageSurface } from "@gtkx/gi/cairo";
import * as Gdk from "@gtkx/gi/gdk";
import * as GLib from "@gtkx/gi/glib";
import * as Gtk from "@gtkx/gi/gtk";
import * as Pango from "@gtkx/gi/pango";
import { GtkButton, GtkDropDown, GtkEntry, GtkPaned, GtkScale, GtkScrolledWindow, GtkTextView } from "@gtkx/react";
import { type RefObject, useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./textview.tsx?raw";

const SCALE_XX_SMALL = 0.5787037037037;
const SCALE_X_LARGE = 1.44;

const headingProps = { weight: Pango.Weight.BOLD, size: 15 * Pango.SCALE } as const;

function createNuclearTexture(): Gdk.Texture {
    const size = 32;
    const surface = ImageSurface.create(Format.ARGB32, size, size);
    const cr = Context.create(surface);

    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 2;

    cr.setLineWidth(1.5);
    cr.setSourceRgba(0, 0, 0, 1);

    cr.arc({ xc: cx, yc: cy, radius: r * 0.15, angle1: 0, angle2: 2 * Math.PI });
    cr.fill();

    for (let i = 0; i < 3; i++) {
        const orbAngle = (i * 2 * Math.PI) / 3;
        cr.save();
        cr.translate(cx, cy);
        cr.rotate(orbAngle);
        cr.scale(1, 0.35);
        cr.newPath();
        cr.arc({ xc: 0, yc: 0, radius: r * 0.85, angle1: 0, angle2: 2 * Math.PI });
        cr.restore();
        cr.stroke();
    }

    const pixelData = surface.getData();
    const stride = surface.getStride();
    const bytes = GLib.Bytes.new([...pixelData]);
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
    const iter = buffer.getStartIter();
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
        if (onClickMe) btn.on("clicked", onClickMe);
        view.addChildAtAnchor(btn, anchors[0]);
    }

    if (anchors[1]) {
        const dd = Gtk.DropDown.newFromStrings(["Option 1", "Option 2", "Option 3"]);
        view.addChildAtAnchor(dd, anchors[1]);
    }

    if (anchors[2]) {
        const adj = Gtk.Adjustment.new(0, 0, 100, 1, 10, 0);
        const scale = Gtk.Scale.new(Gtk.Orientation.HORIZONTAL, adj);
        scale.setSizeRequest(100, -1);
        view.addChildAtAnchor(scale, anchors[2]);
    }

    if (anchors[3]) {
        const entry = new Gtk.Entry();
        entry.setWidthChars(10);
        view.addChildAtAnchor(entry, anchors[3]);
    }
}

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

function handleEasterEgg(sourceView: Gtk.TextView, windowRef: RefObject<Gtk.Window | null>) {
    if (windowRef.current) {
        windowRef.current.present();
        return;
    }

    const buffer = new Gtk.TextBuffer();
    const iter = buffer.getStartIter();
    buffer.insert(iter, "This buffer is shared by a set of nested text views.\n Nested view:\n", -1);
    const anchor = buffer.createChildAnchor(iter);
    buffer.insert(iter, "\nDon't do this in real applications, please.\n", -1);

    const view = new Gtk.TextView();
    view.setBuffer(buffer);
    view.setWrapMode(Gtk.WrapMode.WORD);

    recursiveAttachView(0, view, anchor);

    const win = new Gtk.Window();
    windowRef.current = win;

    const root = sourceView.getRoot();
    if (root instanceof Gtk.Window) {
        win.setTransientFor(root);
        win.setModal(true);
    }

    win.on("close-request", () => {
        windowRef.current = null;
        return false;
    });

    const sw = new Gtk.ScrolledWindow();
    sw.setChild(view);
    win.setChild(sw);
    win.setDefaultSize(300, 400);
    win.present();
}

const TextViewIntroSection = () => (
    <>
        {
            "The text widget can display text with all kinds of nifty attributes. It also supports multiple views of the same buffer; this demo is showing the same buffer in two places.\n\n"
        }
    </>
);

const TextViewFontStylesSection = () => (
    <>
        <GtkTextView.Tag id="heading-font" {...headingProps}>
            {"Font styles. "}
        </GtkTextView.Tag>
        {"For example, you can have "}
        <GtkTextView.Tag id="italic" style={Pango.Style.ITALIC}>
            italic
        </GtkTextView.Tag>
        {", "}
        <GtkTextView.Tag id="bold" weight={Pango.Weight.BOLD}>
            bold
        </GtkTextView.Tag>
        {", or "}
        <GtkTextView.Tag id="monospace" family="monospace">
            {"monospace (typewriter)"}
        </GtkTextView.Tag>
        {", or "}
        <GtkTextView.Tag id="big" size={20 * Pango.SCALE}>
            big
        </GtkTextView.Tag>
        {" text. It's best not to hardcode specific text sizes; you can use relative sizes as with CSS, such as "}
        <GtkTextView.Tag id="xx-small" scale={SCALE_XX_SMALL}>
            xx-small
        </GtkTextView.Tag>
        {" or "}
        <GtkTextView.Tag id="x-large" scale={SCALE_X_LARGE}>
            x-large
        </GtkTextView.Tag>
        {" to ensure that your program properly adapts if the user changes the default font size.\n\n"}
    </>
);

const TextViewColorsSection = () => (
    <>
        <GtkTextView.Tag id="heading-colors" {...headingProps}>
            {"Colors. "}
        </GtkTextView.Tag>
        {"Colors such as "}
        <GtkTextView.Tag id="blue_foreground" foreground="blue">
            {"a blue foreground"}
        </GtkTextView.Tag>
        {" or "}
        <GtkTextView.Tag id="red_background" background="red">
            {"a red background"}
        </GtkTextView.Tag>
        {" or even "}
        <GtkTextView.Tag id="blue_fg" foreground="blue">
            <GtkTextView.Tag id="red_bg" background="red">
                {"a blue foreground on red background"}
            </GtkTextView.Tag>
        </GtkTextView.Tag>
        {" (select that to read it) can be used.\n\n"}
    </>
);

const TextViewUnderlineRiseSection = () => (
    <>
        <GtkTextView.Tag id="heading-underline" {...headingProps}>
            {"Underline, strikethrough, and rise. "}
        </GtkTextView.Tag>
        <GtkTextView.Tag id="strikethrough" strikethrough>
            Strikethrough
        </GtkTextView.Tag>
        {", "}
        <GtkTextView.Tag id="underline" underline={Pango.Underline.SINGLE}>
            underline
        </GtkTextView.Tag>
        {", "}
        <GtkTextView.Tag id="double_underline" underline={Pango.Underline.DOUBLE}>
            {"double underline"}
        </GtkTextView.Tag>
        {", "}
        <GtkTextView.Tag id="superscript" rise={10 * Pango.SCALE} size={8 * Pango.SCALE}>
            superscript
        </GtkTextView.Tag>
        {", and "}
        <GtkTextView.Tag id="subscript" rise={-10 * Pango.SCALE} size={8 * Pango.SCALE}>
            subscript
        </GtkTextView.Tag>
        {" are all supported.\n\n"}
    </>
);

interface ImagesSectionProps {
    iconPaintable: Gtk.IconPaintable | null;
    nuclearPaintable: Gdk.Texture;
}

const TextViewImagesSection = ({ iconPaintable, nuclearPaintable }: ImagesSectionProps) => (
    <>
        <GtkTextView.Tag id="heading-images" {...headingProps}>
            {"Images. "}
        </GtkTextView.Tag>
        {"The buffer can have images in it: "}
        {iconPaintable && <GtkTextView.Paintable paintable={iconPaintable} />}
        <GtkTextView.Paintable paintable={nuclearPaintable} />
        {" for example.\n\n"}
    </>
);

const TextViewSpacingSection = () => (
    <>
        <GtkTextView.Tag id="heading-spacing" {...headingProps}>
            {"Spacing. "}
        </GtkTextView.Tag>
        {"You can adjust the amount of space before each line.\n"}
        <GtkTextView.Tag id="wide_margins_1" leftMargin={50} rightMargin={50}>
            <GtkTextView.Tag id="big_gap_before" pixelsAboveLines={30}>
                {"This line has a whole lot of space before it."}
            </GtkTextView.Tag>
        </GtkTextView.Tag>
        {"\n"}
        <GtkTextView.Tag id="wide_margins_2" leftMargin={50} rightMargin={50}>
            <GtkTextView.Tag id="big_gap_after" pixelsBelowLines={30}>
                {
                    "You can also adjust the amount of space after each line; this line has a whole lot of space after it."
                }
            </GtkTextView.Tag>
        </GtkTextView.Tag>
        {"\n"}
        <GtkTextView.Tag id="wide_margins_3" leftMargin={50} rightMargin={50}>
            <GtkTextView.Tag id="double_spaced" pixelsInsideWrap={10}>
                {
                    "You can also adjust the amount of space between wrapped lines; this line has extra space between each wrapped line in the same paragraph. To show off wrapping, some filler text: the quick brown fox jumped over the lazy dog. Blah blah blah blah blah blah blah blah blah."
                }
            </GtkTextView.Tag>
        </GtkTextView.Tag>
        {"\nAlso note that those lines have extra-wide margins.\n\n"}
    </>
);

const TextViewEditabilitySection = () => (
    <>
        <GtkTextView.Tag id="heading-edit" {...headingProps}>
            {"Editability. "}
        </GtkTextView.Tag>
        <GtkTextView.Tag id="not_editable" editable={false}>
            {"This line is 'locked down' and can't be edited by the user - just try it! You can't delete this line."}
        </GtkTextView.Tag>
        {"\n\n"}
    </>
);

const TextViewWrappingSection = () => (
    <>
        <GtkTextView.Tag id="heading-wrap" {...headingProps}>
            {"Wrapping. "}
        </GtkTextView.Tag>
        <GtkTextView.Tag id="word_wrap" wrapMode={Gtk.WrapMode.WORD}>
            {
                "This line (and most of the others in this buffer) is word-wrapped, using the proper Unicode algorithm. Word wrap should work in all scripts and languages that GTK supports. Let's make this a long paragraph to demonstrate: blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah"
            }
        </GtkTextView.Tag>
        {"\n\n"}
        <GtkTextView.Tag id="char_wrap" wrapMode={Gtk.WrapMode.CHAR}>
            {
                "This line has character-based wrapping, and can wrap between any two character glyphs. Let's make this a long paragraph to demonstrate: blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah"
            }
        </GtkTextView.Tag>
        {"\n\n"}
        <GtkTextView.Tag id="no_wrap" wrapMode={Gtk.WrapMode.NONE}>
            {"This line has all wrapping turned off, so it makes the horizontal scrollbar appear."}
        </GtkTextView.Tag>
        {"\n\n\n"}
    </>
);

const TextViewJustificationSection = () => (
    <>
        <GtkTextView.Tag id="heading-justify" {...headingProps}>
            {"Justification. "}
        </GtkTextView.Tag>
        {"\n"}
        <GtkTextView.Tag id="center" justification={Gtk.Justification.CENTER}>
            {"This line has center justification."}
        </GtkTextView.Tag>
        {"\n"}
        <GtkTextView.Tag id="right_justify" justification={Gtk.Justification.RIGHT}>
            {"This line has right justification."}
        </GtkTextView.Tag>
        {"\n\n"}
        <GtkTextView.Tag id="wide_margins" leftMargin={50} rightMargin={50}>
            {
                "This line has big wide margins. Text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text."
            }
        </GtkTextView.Tag>
        {"\n\n"}
    </>
);

const TextViewInternationalSection = () => (
    <>
        <GtkTextView.Tag id="heading-intl" {...headingProps}>
            {"Internationalization. "}
        </GtkTextView.Tag>
        {
            " You can put all sorts of Unicode text in the buffer.\n\nGerman (Deutsch Süd) Grüß Gott\nGreek (Ελληνικά) Γειά σας\nHebrew שלום\nJapanese (日本語)\n\nThe widget properly handles bidirectional text, word wrapping, DOS/UNIX/Unicode paragraph separators, grapheme boundaries, and so on using the Pango internationalization framework.\n"
        }
        {"Here's a word-wrapped quote in a right-to-left language:\n"}
        <GtkTextView.Tag
            id="rtl_quote"
            wrapMode={Gtk.WrapMode.WORD}
            direction={Gtk.TextDirection.RTL}
            indent={30}
            leftMargin={20}
            rightMargin={20}
        >
            {
                "وقد بدأ ثلاث من أكثر المؤسسات تقدما في شبكة اكسيون برامجها كمنظمات لا تسعى للربح، ثم تحولت في السنوات الخمس الماضية إلى مؤسسات مالية منظمة، وباتت جزءا من النظام المالي في بلدانها، ولكنها تتخصص في خدمة قطاع المشروعات الصغيرة. وأحد أكثر هذه المؤسسات نجاحا هو «بانكوسول» في بوليفيا."
            }
        </GtkTextView.Tag>
    </>
);

const TextViewWidgetsSection = ({ onClickMe }: { onClickMe: () => void }) => (
    <>
        {"\n\nYou can put widgets in the buffer: Here's a button: "}
        <GtkTextView.Anchor>
            <GtkButton label="Click Me" onClicked={onClickMe} />
        </GtkTextView.Anchor>
        {" and a menu: "}
        <GtkTextView.Anchor>
            <GtkDropDown
                items={[
                    { id: "opt1", value: "Option 1" },
                    { id: "opt2", value: "Option 2" },
                    { id: "opt3", value: "Option 3" },
                ]}
            />
        </GtkTextView.Anchor>
        {" and a scale: "}
        <GtkTextView.Anchor>
            <GtkScale
                orientation={Gtk.Orientation.HORIZONTAL}
                lower={0}
                upper={100}
                stepIncrement={1}
                pageIncrement={10}
                widthRequest={100}
            />
        </GtkTextView.Anchor>
        {" finally a text entry: "}
        <GtkTextView.Anchor>
            <GtkEntry widthChars={10} />
        </GtkTextView.Anchor>
        {
            ".\n\nThis demo doesn't demonstrate all the GtkTextBuffer features; it leaves out, for example: invisible/hidden text, tab stops, application-drawn areas on the sides of the widget for displaying breakpoints and such..."
        }
    </>
);

const TextViewDemo = () => {
    const textView1Ref = useRef<Gtk.TextView | null>(null);
    const textView2Ref = useRef<Gtk.TextView | null>(null);
    const easterEggWindowRef = useRef<Gtk.Window | null>(null);
    const [sharedBuffer] = useState(() => new Gtk.TextBuffer());

    const handleClickMe = useCallback(() => {
        const tv = textView1Ref.current;
        if (tv) handleEasterEgg(tv, easterEggWindowRef);
    }, []);

    const iconPaintable = useMemo(() => {
        const display = Gdk.Display.getDefault();
        if (!display) return null;
        const iconTheme = Gtk.IconTheme.getForDisplay(display);
        return iconTheme.lookupIcon("drive-harddisk", null, 32, 1, Gtk.TextDirection.NONE, 0);
    }, []);

    const nuclearPaintable = useMemo(() => createNuclearTexture(), []);

    useLayoutEffect(() => {
        const tv2 = textView2Ref.current;
        if (!tv2) return;

        const anchors = findChildAnchors(sharedBuffer);
        attachWidgetClones(tv2, anchors, () => {
            if (textView2Ref.current) handleEasterEgg(textView2Ref.current, easterEggWindowRef);
        });

        return () => {
            if (easterEggWindowRef.current) {
                easterEggWindowRef.current.destroy();
                easterEggWindowRef.current = null;
            }
        };
    }, [sharedBuffer]);

    return (
        <GtkPaned
            orientation={Gtk.Orientation.VERTICAL}
            resizeStartChild={false}
            resizeEndChild
            startChild={
                <GtkScrolledWindow
                    hscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
                    vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
                >
                    <GtkTextView
                        ref={textView1Ref}
                        name="text-view-1"
                        wrapMode={Gtk.WrapMode.WORD}
                        buffer={sharedBuffer}
                    >
                        <TextViewIntroSection />
                        <TextViewFontStylesSection />
                        <TextViewColorsSection />
                        <TextViewUnderlineRiseSection />
                        <TextViewImagesSection iconPaintable={iconPaintable} nuclearPaintable={nuclearPaintable} />
                        <TextViewSpacingSection />
                        <TextViewEditabilitySection />
                        <TextViewWrappingSection />
                        <TextViewJustificationSection />
                        <TextViewInternationalSection />
                        <TextViewWidgetsSection onClickMe={handleClickMe} />
                    </GtkTextView>
                </GtkScrolledWindow>
            }
            endChild={
                <GtkScrolledWindow
                    hscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
                    vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
                >
                    <GtkTextView
                        ref={textView2Ref}
                        name="text-view-2"
                        wrapMode={Gtk.WrapMode.WORD}
                        buffer={sharedBuffer}
                    />
                </GtkScrolledWindow>
            }
        />
    );
};

export const textviewDemo: Demo = {
    id: "textview",
    title: "Text View/Multiple Views",
    description:
        "The GtkTextView widget displays a GtkTextBuffer. One GtkTextBuffer can be displayed by multiple GtkTextViews. This demo has two views displaying a single buffer, and shows off the widget's text formatting features.",
    keywords: [],
    component: TextViewDemo,
    sourceCode,
    defaultWidth: 450,
    defaultHeight: 450,
};
