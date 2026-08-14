import { DropDown } from "@gtkx/components";
import { Context, Format, ImageSurface } from "@gtkx/gi/cairo";
import * as Gdk from "@gtkx/gi/gdk";
import * as GLib from "@gtkx/gi/glib";
import * as Gtk from "@gtkx/gi/gtk";
import * as Pango from "@gtkx/gi/pango";
import {
    GtkAdjustment,
    GtkButton,
    GtkEntry,
    GtkPaned,
    GtkScale,
    GtkScrolledWindow,
    GtkTextBuffer,
    GtkTextChildAnchor,
    GtkTextTag,
    GtkTextView,
} from "@gtkx/jsx/gtk";
import { useParentWindow } from "@gtkx/react";
import { type RefObject, useLayoutEffect, useRef, useState } from "react";
import type { Demo } from "../types.js";
import { lookupIconPaintable } from "../icon-paintable.js";
import sourceCode from "./textview.tsx?raw";

type ImagesSectionProps = {
    iconPaintable: Gtk.IconPaintable | null;
    nuclearPaintable: Gdk.Texture;
};

type PrimaryTextViewProps = {
    textView1Ref: RefObject<Gtk.TextView | null>;
    setSharedBuffer: (buffer: Gtk.TextBuffer | null) => void;
    iconPaintable: Gtk.IconPaintable | null;
    nuclearPaintable: Gdk.Texture;
    onClickMe: () => void;
};

type SecondaryTextViewProps = {
    textView2Ref: RefObject<Gtk.TextView | null>;
    sharedBuffer: Gtk.TextBuffer | null;
};

const SCALE_XX_SMALL = 0.5787037037037;
const SCALE_X_LARGE = 1.44;
const headingProps = { weight: Pango.Weight.BOLD, size: 15 * Pango.SCALE } as const;

const textviewDemo: Demo = {
    id: "textview",
    title: "Text View/Multiple Views",
    description:
        "The GtkTextView widget displays a GtkTextBuffer. One GtkTextBuffer can be displayed by " +
        "multiple GtkTextViews. This demo has two views displaying a single buffer, and shows off " +
        "the widget's text formatting features.",
    keywords: [],
    component: TextViewDemo,
    sourceCode,
    defaultWidth: 450,
    defaultHeight: 450,
};

function createNuclearTexture(): Gdk.Texture {
    const size = 32;
    const surface = ImageSurface.create(Format.ARGB32, size, size);
    const cr = Context.create(surface);
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
    const bytes = GLib.Bytes.new(pixelData);
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

        if (anchor) {
            anchors.push(anchor);
        }
    } while (iter.forwardChar());

    return anchors;
}

function attachButtonClone(view: Gtk.TextView, anchor: Gtk.TextChildAnchor, onClickMe?: () => void) {
    const btn = new Gtk.Button();
    btn.setLabel("Click Me");

    if (onClickMe) {
        btn.on("clicked", onClickMe);
    }

    view.addChildAtAnchor(btn, anchor);
}

function attachWidgetClones(view: Gtk.TextView, anchors: Gtk.TextChildAnchor[], onClickMe?: () => void) {
    if (anchors[0]) {
        attachButtonClone(view, anchors[0], onClickMe);
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
    if (depth > 4) {
        return;
    }

    const childView = new Gtk.TextView();
    childView.setBuffer(view.getBuffer());
    childView.setSizeRequest(260 - 20 * depth, -1);
    const frame = new Gtk.Frame();
    frame.setChild(childView);
    view.addChildAtAnchor(frame, anchor);
    recursiveAttachView(depth + 1, childView, anchor);
}

function handleEasterEgg(parentWindow: Gtk.Window | null, windowRef: RefObject<Gtk.Window | null>) {
    if (windowRef.current) {
        windowRef.current.present();

        return;
    }

    const buffer = new Gtk.TextBuffer();
    const iter = buffer.getStartIter();
    buffer.insert(iter, "This buffer is shared by a set of nested text views.\n Nested view:\n", -1);
    const anchor = buffer.createChildAnchor(iter);
    buffer.insert(iter, "\nDon't do this in production applications, please.\n", -1);
    const view = new Gtk.TextView();
    view.setBuffer(buffer);
    view.setWrapMode(Gtk.WrapMode.WORD);
    recursiveAttachView(0, view, anchor);
    const win = new Gtk.Window();
    windowRef.current = win;

    if (parentWindow) {
        win.setTransientFor(parentWindow);
        win.setModal(true);
    }

    win.on("close-request", () => {
        windowRef.current = null;

        return Gdk.EVENT_PROPAGATE;
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
            "The text widget can display text with all kinds of nifty attributes. It also supports " +
            "multiple views of the same buffer; this demo is showing the same buffer in two places.\n\n"
        }
    </>
);

const TextViewFontStylesSection = () => (
    <>
        <GtkTextTag name="heading-font" {...headingProps}>
            {"Font styles. "}
        </GtkTextTag>
        {"For example, you can have "}
        <GtkTextTag name="italic" style={Pango.Style.ITALIC}>
            italic
        </GtkTextTag>
        {", "}
        <GtkTextTag name="bold" weight={Pango.Weight.BOLD}>
            bold
        </GtkTextTag>
        {", or "}
        <GtkTextTag name="monospace" family="monospace">
            monospace (typewriter)
        </GtkTextTag>
        {", or "}
        <GtkTextTag name="big" size={20 * Pango.SCALE}>
            big
        </GtkTextTag>
        {" text. It's best not to hardcode specific text sizes; you can use relative sizes as with CSS, such as "}
        <GtkTextTag name="xx-small" scale={SCALE_XX_SMALL}>
            xx-small
        </GtkTextTag>
        {" or "}
        <GtkTextTag name="x-large" scale={SCALE_X_LARGE}>
            x-large
        </GtkTextTag>
        {" to ensure that your program properly adapts if the user changes the default font size.\n\n"}
    </>
);

const TextViewColorsSection = () => (
    <>
        <GtkTextTag name="heading-colors" {...headingProps}>
            {"Colors. "}
        </GtkTextTag>
        {"Colors such as "}
        <GtkTextTag name="blue_foreground" foreground="blue">
            a blue foreground
        </GtkTextTag>
        {" or "}
        <GtkTextTag name="red_background" background="red">
            a red background
        </GtkTextTag>
        {" or even "}
        <GtkTextTag name="blue_fg" foreground="blue">
            <GtkTextTag name="red_bg" background="red">
                a blue foreground on red background
            </GtkTextTag>
        </GtkTextTag>
        {" (select that to read it) can be used.\n\n"}
    </>
);

const TextViewUnderlineRiseSection = () => (
    <>
        <GtkTextTag name="heading-underline" {...headingProps}>
            {"Underline, strikethrough, and rise. "}
        </GtkTextTag>
        <GtkTextTag name="strikethrough" strikethrough>
            Strikethrough
        </GtkTextTag>
        {", "}
        <GtkTextTag name="underline" underline={Pango.Underline.SINGLE}>
            underline
        </GtkTextTag>
        {", "}
        <GtkTextTag name="double_underline" underline={Pango.Underline.DOUBLE}>
            double underline
        </GtkTextTag>
        {", "}
        <GtkTextTag name="superscript" rise={10 * Pango.SCALE} size={8 * Pango.SCALE}>
            superscript
        </GtkTextTag>
        {", and "}
        <GtkTextTag name="subscript" rise={-10 * Pango.SCALE} size={8 * Pango.SCALE}>
            subscript
        </GtkTextTag>
        {" are all supported.\n\n"}
    </>
);

const TextViewImagesSection = ({ iconPaintable, nuclearPaintable }: ImagesSectionProps) => (
    <>
        <GtkTextTag name="heading-images" {...headingProps}>
            {"Images. "}
        </GtkTextTag>
        {"The buffer can have images in it: "}
        {iconPaintable && <GtkTextChildAnchor paintable={iconPaintable} />}
        <GtkTextChildAnchor paintable={nuclearPaintable} />
        {" for example.\n\n"}
    </>
);

const TextViewSpacingSection = () => (
    <>
        <GtkTextTag name="heading-spacing" {...headingProps}>
            {"Spacing. "}
        </GtkTextTag>
        {"You can adjust the amount of space before each line.\n"}
        <GtkTextTag name="wide_margins_1" leftMargin={50} rightMargin={50}>
            <GtkTextTag name="big_gap_before" pixelsAboveLines={30}>
                This line has a whole lot of space before it.
            </GtkTextTag>
        </GtkTextTag>
        {"\n"}
        <GtkTextTag name="wide_margins_2" leftMargin={50} rightMargin={50}>
            <GtkTextTag name="big_gap_after" pixelsBelowLines={30}>
                You can also adjust the amount of space after each line; this line has a whole lot of space after it.
            </GtkTextTag>
        </GtkTextTag>
        {"\n"}
        <GtkTextTag name="wide_margins_3" leftMargin={50} rightMargin={50}>
            <GtkTextTag name="double_spaced" pixelsInsideWrap={10}>
                You can also adjust the amount of space between wrapped lines; this line has extra space
                between each wrapped line in the same paragraph. To show off wrapping, some filler text:
                the quick brown fox jumped over the lazy dog. Blah blah blah blah blah blah blah blah blah.
            </GtkTextTag>
        </GtkTextTag>
        {"\nAlso note that those lines have extra-wide margins.\n\n"}
    </>
);

const TextViewEditabilitySection = () => (
    <>
        <GtkTextTag name="heading-edit" {...headingProps}>
            {"Editability. "}
        </GtkTextTag>
        <GtkTextTag name="not_editable" editable={false}>
            This line is 'locked down' and can't be edited by the user - just try it! You can't delete this line.
        </GtkTextTag>
        {"\n\n"}
    </>
);

const TextViewWrappingSection = () => (
    <>
        <GtkTextTag name="heading-wrap" {...headingProps}>
            {"Wrapping. "}
        </GtkTextTag>
        <GtkTextTag name="word_wrap" wrapMode={Gtk.WrapMode.WORD}>
            This line (and most of the others in this buffer) is word-wrapped, using the proper Unicode
            algorithm. Word wrap should work in all scripts and languages that GTK supports. Let's make
            this a long paragraph to demonstrate: blah blah blah blah blah blah blah blah blah blah blah
            blah blah blah blah
        </GtkTextTag>
        {"\n\n"}
        <GtkTextTag name="char_wrap" wrapMode={Gtk.WrapMode.CHAR}>
            This line has character-based wrapping, and can wrap between any two character glyphs. Let's
            make this a long paragraph to demonstrate: blah blah blah blah blah blah blah blah blah blah
            blah blah blah blah blah
        </GtkTextTag>
        {"\n\n"}
        <GtkTextTag name="no_wrap" wrapMode={Gtk.WrapMode.NONE}>
            This line has all wrapping turned off, so it makes the horizontal scrollbar appear.
        </GtkTextTag>
        {"\n".repeat(3)}
    </>
);

const TextViewJustificationSection = () => (
    <>
        <GtkTextTag name="heading-justify" {...headingProps}>
            {"Justification. "}
        </GtkTextTag>
        {"\n"}
        <GtkTextTag name="center" justification={Gtk.Justification.CENTER}>
            This line has center justification.
        </GtkTextTag>
        {"\n"}
        <GtkTextTag name="right_justify" justification={Gtk.Justification.RIGHT}>
            This line has right justification.
        </GtkTextTag>
        {"\n\n"}
        <GtkTextTag name="wide_margins" leftMargin={50} rightMargin={50}>
            This line has big wide margins. Text text text text text text text text text text text text
            text text text text text text text text text text text text text text text text text text
            text text text text text.
        </GtkTextTag>
        {"\n\n"}
    </>
);

const TextViewInternationalSection = () => (
    <>
        <GtkTextTag name="heading-intl" {...headingProps}>
            {"Internationalization. "}
        </GtkTextTag>
        {
            " You can put all sorts of Unicode text in the buffer.\n\n" +
            "German (Deutsch Süd) Grüß Gott\n" +
            "Greek (Ελληνικά) Γειά σας\n" +
            "Hebrew שלום\n" +
            "Japanese (日本語)\n\n" +
            "The widget properly handles bidirectional text, word wrapping, DOS/UNIX/Unicode paragraph " +
            "separators, grapheme boundaries, and so on using the Pango internationalization framework.\n"
        }
        {"Here's a word-wrapped quote in a right-to-left language:\n"}
        <GtkTextTag
            name="rtl_quote"
            wrapMode={Gtk.WrapMode.WORD}
            direction={Gtk.TextDirection.RTL}
            indent={30}
            leftMargin={20}
            rightMargin={20}
        >
            وقد بدأ ثلاث من أكثر المؤسسات تقدما في شبكة اكسيون برامجها كمنظمات لا تسعى للربح، ثم تحولت في
            السنوات الخمس الماضية إلى مؤسسات مالية منظمة، وباتت جزءا من النظام المالي في بلدانها، ولكنها
            تتخصص في خدمة قطاع المشروعات الصغيرة. وأحد أكثر هذه المؤسسات نجاحا هو «بانكوسول» في بوليفيا.
        </GtkTextTag>
    </>
);

const TextViewWidgetsSection = ({ onClickMe }: { onClickMe: () => void }) => {
    return (
        <>
            {"\n\nYou can put widgets in the buffer: Here's a button: "}
            <GtkTextChildAnchor>
                <GtkButton label="Click Me" onClicked={onClickMe} />
            </GtkTextChildAnchor>
            {" and a menu: "}
            <GtkTextChildAnchor>
                <DropDown
                    items={[
                        { id: "opt1", value: "Option 1" },
                        { id: "opt2", value: "Option 2" },
                        { id: "opt3", value: "Option 3" },
                    ]}
                />
            </GtkTextChildAnchor>
            {" and a scale: "}
            <GtkTextChildAnchor>
                <GtkScale
                    orientation={Gtk.Orientation.HORIZONTAL}
                    adjustment={<GtkAdjustment lower={0} upper={100} stepIncrement={1} pageIncrement={10} />}
                    widthRequest={100}
                />
            </GtkTextChildAnchor>
            {" finally a text entry: "}
            <GtkTextChildAnchor>
                <GtkEntry widthChars={10} />
            </GtkTextChildAnchor>
            {
                ".\n\nThis demo doesn't demonstrate all the GtkTextBuffer features; it leaves out, " +
                "for example: invisible/hidden text, tab stops, application-drawn areas on the sides " +
                "of the widget for displaying breakpoints and such..."
            }
        </>
    );
};

function PrimaryTextView({
    textView1Ref,
    setSharedBuffer,
    iconPaintable,
    nuclearPaintable,
    onClickMe,
}: PrimaryTextViewProps) {
    return (
        <GtkScrolledWindow hscrollbarPolicy={Gtk.PolicyType.AUTOMATIC} vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}>
            <GtkTextView
                ref={textView1Ref}
                name="text-view-1"
                wrapMode={Gtk.WrapMode.WORD}
                buffer={(
                    <GtkTextBuffer ref={setSharedBuffer}>
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
                        <TextViewWidgetsSection onClickMe={onClickMe} />
                    </GtkTextBuffer>
                )}
            />
        </GtkScrolledWindow>
    );
}

function SecondaryTextView({ textView2Ref, sharedBuffer }: SecondaryTextViewProps) {
    return (
        <GtkScrolledWindow hscrollbarPolicy={Gtk.PolicyType.AUTOMATIC} vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}>
            {sharedBuffer && (
                <GtkTextView ref={textView2Ref} name="text-view-2" wrapMode={Gtk.WrapMode.WORD} buffer={sharedBuffer} />
            )}
        </GtkScrolledWindow>
    );
}

function destroyEasterEggWindow(windowRef: RefObject<Gtk.Window | null>) {
    if (!windowRef.current) {
        return;
    }

    windowRef.current.destroy();
    windowRef.current = null;
}

function attachSecondaryWidgets(
    textView: Gtk.TextView | null,
    sharedBuffer: Gtk.TextBuffer | null,
    parentWindow: Gtk.Window | null,
    easterEggWindowRef: RefObject<Gtk.Window | null>,
) {
    if (!textView || !sharedBuffer) {
        return;
    }

    const anchors = findChildAnchors(sharedBuffer);

    attachWidgetClones(textView, anchors, () => {
        handleEasterEgg(parentWindow, easterEggWindowRef);
    });

    return () => {
        destroyEasterEggWindow(easterEggWindowRef);
    };
}

function TextViewDemo() {
    const parentWindow = useParentWindow();
    const textView1Ref = useRef<Gtk.TextView | null>(null);
    const textView2Ref = useRef<Gtk.TextView | null>(null);
    const easterEggWindowRef = useRef<Gtk.Window | null>(null);
    const [sharedBuffer, setSharedBuffer] = useState<Gtk.TextBuffer | null>(null);
    const [iconPaintable] = useState(() => lookupIconPaintable("drive-harddisk", 32));
    const [nuclearPaintable] = useState(createNuclearTexture);

    const handleClickMe = () => {
        handleEasterEgg(parentWindow, easterEggWindowRef);
    };

    useLayoutEffect(
        () => attachSecondaryWidgets(textView2Ref.current, sharedBuffer, parentWindow, easterEggWindowRef),
        [sharedBuffer, parentWindow],
    );

    return (
        <GtkPaned
            orientation={Gtk.Orientation.VERTICAL}
            resizeStartChild={false}
            resizeEndChild
            startChild={(
                <PrimaryTextView
                    textView1Ref={textView1Ref}
                    setSharedBuffer={setSharedBuffer}
                    iconPaintable={iconPaintable}
                    nuclearPaintable={nuclearPaintable}
                    onClickMe={handleClickMe}
                />
            )}
            endChild={<SecondaryTextView textView2Ref={textView2Ref} sharedBuffer={sharedBuffer} />}
        />
    );
}

export { textviewDemo };
