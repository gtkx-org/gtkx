import { css } from "@gtkx/css";
import * as Gdk from "@gtkx/ffi/gdk";
import * as GObject from "@gtkx/ffi/gobject";
import * as Gtk from "@gtkx/ffi/gtk";
import * as Pango from "@gtkx/ffi/pango";
import {
    GtkBox,
    GtkButton,
    GtkCheckButton,
    GtkColorDialogButton,
    GtkEntry,
    GtkExpander,
    GtkFontDialogButton,
    GtkGestureClick,
    GtkGrid,
    GtkHeaderBar,
    GtkLabel,
    GtkScale,
    GtkScrolledWindow,
    GtkShortcutController,
    GtkStack,
    GtkTextView,
    GtkToggleButton,
    GtkViewport,
} from "@gtkx/react";

const Slot = "Slot" as const;

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Demo, DemoProps } from "../types.js";
import sourceCode from "./font-features.tsx?raw";

const FEATURE_DISPLAY_NAMES: Record<string, string> = {
    kern: "Kerning",
    liga: "Standard Ligatures",
    dlig: "Discretionary Ligatures",
    hlig: "Historical Ligatures",
    clig: "Contextual Ligatures",
    rlig: "Required Ligatures",
    smcp: "Small Capitals",
    c2sc: "Small Capitals From Capitals",
    pcap: "Petite Capitals",
    c2pc: "Petite Capitals From Capitals",
    unic: "Unicase",
    cpsp: "Capital Spacing",
    case: "Case-Sensitive Forms",
    lnum: "Lining Figures",
    onum: "Oldstyle Figures",
    pnum: "Proportional Figures",
    tnum: "Tabular Figures",
    frac: "Fractions",
    afrc: "Alternative Fractions",
    zero: "Slashed Zero",
    nalt: "Alternate Annotation Forms",
    sinf: "Scientific Inferiors",
    swsh: "Swash",
    cswh: "Contextual Swash",
    locl: "Localized Forms",
    calt: "Contextual Alternates",
    falt: "Final Glyph on Line Alternates",
    hist: "Historical Forms",
    salt: "Stylistic Alternates",
    jalt: "Justification Alternates",
    titl: "Titling",
    rand: "Randomize",
    subs: "Subscript",
    sups: "Superscript",
    ordn: "Ordinals",
    ltra: "Left-to-right alternates",
    ltrm: "Left-to-right mirrored forms",
    rtla: "Right-to-left alternates",
    rtlm: "Right-to-left mirrored forms",
    rclt: "Required Contextual Alternates",
    init: "Initial Forms",
    medi: "Medial Forms",
    med2: "Medial Forms #2",
    fina: "Terminal Forms",
    fin2: "Terminal Forms #2",
    fin3: "Terminal Forms #3",
    isol: "Isolated Forms",
    fwid: "Full Widths",
    hwid: "Half Widths",
    halt: "Alternate Half Widths",
    pwid: "Proportional Widths",
    palt: "Proportional Alternate Widths",
    twid: "Third Widths",
    qwid: "Quarter Widths",
    dtls: "Dotless Forms",
    flac: "Flattened accent forms",
    mgrk: "Mathematical Greek",
    ssty: "Math script style alternates",
    opbd: "Optical Bounds",
    lfbd: "Left Bounds",
    rtbd: "Right Bounds",
    numr: "Numerators",
    dnom: "Denominators",
};

interface FeatureGroup {
    title: string;
    type: "check" | "radio";
    tags: string[];
}

const FEATURE_GROUPS: FeatureGroup[] = [
    { title: "Kerning", type: "check", tags: ["kern"] },
    { title: "Ligatures", type: "check", tags: ["liga", "dlig", "hlig", "clig", "rlig"] },
    {
        title: "Letter Case",
        type: "check",
        tags: ["smcp", "c2sc", "pcap", "c2pc", "unic", "cpsp", "case"],
    },
    { title: "Number Case", type: "radio", tags: ["xxxx", "lnum", "onum"] },
    { title: "Number Spacing", type: "radio", tags: ["xxxx", "pnum", "tnum"] },
    { title: "Fractions", type: "radio", tags: ["xxxx", "frac", "afrc"] },
    { title: "Numeric Extras", type: "check", tags: ["zero", "nalt", "sinf"] },
    {
        title: "Character Alternatives",
        type: "check",
        tags: [
            "swsh",
            "cswh",
            "locl",
            "calt",
            "falt",
            "hist",
            "salt",
            "jalt",
            "titl",
            "rand",
            "subs",
            "sups",
            "ordn",
            "ltra",
            "ltrm",
            "rtla",
            "rtlm",
            "rclt",
        ],
    },
    {
        title: "Positional Alternatives",
        type: "check",
        tags: ["init", "medi", "med2", "fina", "fin2", "fin3", "isol"],
    },
    {
        title: "Width Variants",
        type: "check",
        tags: ["fwid", "hwid", "halt", "pwid", "palt", "twid", "qwid"],
    },
    {
        title: "Alternative Stylistic Sets",
        type: "check",
        tags: [
            "ss01",
            "ss02",
            "ss03",
            "ss04",
            "ss05",
            "ss06",
            "ss07",
            "ss08",
            "ss09",
            "ss10",
            "ss11",
            "ss12",
            "ss13",
            "ss14",
            "ss15",
            "ss16",
            "ss17",
            "ss18",
            "ss19",
            "ss20",
        ],
    },
    {
        title: "Character Variants",
        type: "check",
        tags: [
            "cv01",
            "cv02",
            "cv03",
            "cv04",
            "cv05",
            "cv06",
            "cv07",
            "cv08",
            "cv09",
            "cv10",
            "cv11",
            "cv12",
            "cv13",
            "cv14",
            "cv15",
            "cv16",
            "cv17",
            "cv18",
            "cv19",
            "cv20",
        ],
    },
    { title: "Mathematical", type: "check", tags: ["dtls", "flac", "mgrk", "ssty"] },
    { title: "Optical Bounds", type: "check", tags: ["opbd", "lfbd", "rtbd"] },
];

type FeatureState = "inconsistent" | "active" | "inactive";

const SS_RE = /^ss(\d{2})$/;
const CV_RE = /^cv(\d{2})$/;

const getFeatureDisplayName = (tag: string): string => {
    if (tag === "xxxx") return "Default";
    const ssMatch = SS_RE.exec(tag);
    if (ssMatch) return `Stylistic Set ${Number.parseInt(ssMatch[1] ?? "0", 10)}`;
    const cvMatch = CV_RE.exec(tag);
    if (cvMatch) return `Character Variant ${Number.parseInt(cvMatch[1] ?? "0", 10)}`;
    return FEATURE_DISPLAY_NAMES[tag] ?? tag;
};

const buildRadioFeaturePart = (group: { title: string }, radioStates: Map<string, string>): string | null => {
    const selected = radioStates.get(group.title) ?? "xxxx";
    return selected === "xxxx" ? null : `"${selected}" 1`;
};

const buildCheckFeatureParts = (group: { tags: string[] }, checkStates: Map<string, FeatureState>): string[] => {
    const parts: string[] = [];
    for (const tag of group.tags) {
        const state = checkStates.get(tag) ?? "inconsistent";
        if (state === "inconsistent") continue;
        parts.push(`"${tag}" ${state === "active" ? "1" : "0"}`);
    }
    return parts;
};

const WATERFALL_SIZES = [7, 8, 9, 10, 12, 14, 16, 20, 24, 30, 40, 50, 60, 70, 90];

const ALPHABET_SAMPLES = ["abcdefghijklmnopqrstuvwxzy", "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "0123456789", "!@#$%^&*/?;"];

const PARAGRAPH_SAMPLES = [
    "Grumpy wizards make toxic brew for the evil Queen and Jack. A quick movement of the enemy will jeopardize six gunboats. The job of waxing linoleum frequently peeves chintzy kids. My girl wove six dozen plaid jackets before she quit. Twelve ziggurats quickly jumped a finch box.",
    "\u0420\u0430\u0437\u044a\u044f\u0440\u0435\u043d\u043d\u044b\u0439 \u0447\u0442\u0435\u0446 \u044d\u0433\u043e\u0438\u0441\u0442\u0438\u0447\u043d\u043e \u0431\u044c\u0451\u0442 \u043f\u044f\u0442\u044c\u044e \u0436\u0435\u0440\u0434\u044f\u043c\u0438 \u0448\u0443\u0441\u0442\u0440\u043e\u0433\u043e \u0444\u0435\u0445\u0442\u043e\u0432\u0430\u043b\u044c\u0449\u0438\u043a\u0430. \u041d\u0430\u0448 \u0431\u0430\u043d\u043a \u0432\u0447\u0435\u0440\u0430 \u0436\u0435 \u0432\u044b\u043f\u043b\u0430\u0442\u0438\u043b \u0424.\u042f. \u042d\u0439\u0445\u0433\u043e\u043b\u044c\u0434\u0443 \u043a\u043e\u043c\u0438\u0441\u0441\u0438\u044e \u0437\u0430 \u0446\u0435\u043d\u043d\u044b\u0435 \u0432\u0435\u0449\u0438. \u042d\u0445, \u0447\u0443\u0436\u0430\u043a, \u043e\u0431\u0449\u0438\u0439 \u0441\u044a\u0451\u043c \u0446\u0435\u043d \u0448\u043b\u044f\u043f (\u044e\u0444\u0442\u044c) \u2013 \u0432\u0434\u0440\u044b\u0437\u0433! \u0412 \u0447\u0430\u0449\u0430\u0445 \u044e\u0433\u0430 \u0436\u0438\u043b \u0431\u044b \u0446\u0438\u0442\u0440\u0443\u0441? \u0414\u0430, \u043d\u043e \u0444\u0430\u043b\u044c\u0448\u0438\u0432\u044b\u0439 \u044d\u043a\u0437\u0435\u043c\u043f\u043b\u044f\u0440!",
    "\u03a4\u03ac\u03c7\u03b9\u03c3\u03c4\u03b7 \u03b1\u03bb\u03ce\u03c0\u03b7\u03be \u03b2\u03b1\u03c6\u03ae\u03c2 \u03c8\u03b7\u03bc\u03ad\u03bd\u03b7 \u03b3\u03b7, \u03b4\u03c1\u03b1\u03c3\u03ba\u03b5\u03bb\u03af\u03b6\u03b5\u03b9 \u03c5\u03c0\u03ad\u03c1 \u03bd\u03c9\u03b8\u03c1\u03bf\u03cd \u03ba\u03c5\u03bd\u03cc\u03c2",
];

type ViewMode = "plain" | "waterfall" | "edit";

const createDefaultFgColor = () => new Gdk.RGBA({ red: 0, green: 0, blue: 0, alpha: 1 });
const createDefaultBgColor = () => new Gdk.RGBA({ red: 1, green: 1, blue: 1, alpha: 1 });
const createDefaultFontDesc = () => Pango.FontDescription.fromString("Sans 14");

const createInitialCheckStates = (): Map<string, FeatureState> => {
    const states = new Map<string, FeatureState>();
    for (const group of FEATURE_GROUPS) {
        if (group.type === "check") {
            for (const tag of group.tags) {
                states.set(tag, "inconsistent");
            }
        }
    }
    return states;
};

const createInitialRadioStates = (): Map<string, string> => {
    const states = new Map<string, string>();
    for (const group of FEATURE_GROUPS) {
        if (group.type === "radio") {
            states.set(group.title, "xxxx");
        }
    }
    return states;
};

const FontFeaturesDemo = ({ window }: DemoProps) => {
    const [fontDesc, setFontDesc] = useState<Pango.FontDescription | null>(createDefaultFontDesc);
    const [checkStates, setCheckStates] = useState<Map<string, FeatureState>>(createInitialCheckStates);
    const [radioStates, setRadioStates] = useState<Map<string, string>>(createInitialRadioStates);
    const [fgColor, setFgColor] = useState<Gdk.RGBA>(createDefaultFgColor);
    const [bgColor, setBgColor] = useState<Gdk.RGBA>(createDefaultBgColor);
    const [size, setSize] = useState(14);
    const [letterSpacing, setLetterSpacing] = useState(0);
    const [lineHeight, setLineHeight] = useState(1);
    const [viewMode, setViewMode] = useState<ViewMode>("plain");
    const [previewText, setPreviewText] = useState(PARAGRAPH_SAMPLES[0] ?? "");
    const sampleCounterRef = useRef(0);
    const savedTextRef = useRef("");
    const previewLabelRef = useRef<Gtk.Label | null>(null);
    const editTextViewRef = useRef<Gtk.TextView | null>(null);
    const containerRef = useRef<Gtk.Box | null>(null);

    useLayoutEffect(() => {
        const win = window.current;
        if (win) {
            win.setDefaultSize(600, 500);
        }
    }, [window]);

    const toggleCheck = useCallback((tag: string) => {
        setCheckStates((prev) => {
            const next = new Map(prev);
            const current = next.get(tag) ?? "inconsistent";
            if (current === "inconsistent") next.set(tag, "active");
            else if (current === "active") next.set(tag, "inactive");
            else next.set(tag, "active");
            return next;
        });
    }, []);

    const resetToInconsistent = useCallback((tag: string) => {
        setCheckStates((prev) => {
            const next = new Map(prev);
            next.set(tag, "inconsistent");
            return next;
        });
    }, []);

    const selectRadio = useCallback((groupTitle: string, tag: string) => {
        setRadioStates((prev) => {
            const next = new Map(prev);
            next.set(groupTitle, tag);
            return next;
        });
    }, []);

    const swapColors = useCallback(() => {
        const oldFg = fgColor;
        const oldBg = bgColor;
        setFgColor(new Gdk.RGBA({ red: oldBg.red, green: oldBg.green, blue: oldBg.blue, alpha: 1 }));
        setBgColor(new Gdk.RGBA({ red: oldFg.red, green: oldFg.green, blue: oldFg.blue, alpha: 1 }));
    }, [fgColor, bgColor]);

    const resetBasic = useCallback(() => {
        setSize(20);
        setLetterSpacing(0);
        setLineHeight(1);
        setFgColor(createDefaultFgColor());
        setBgColor(createDefaultBgColor());
    }, []);

    const resetFeatures = useCallback(() => {
        setCheckStates(createInitialCheckStates());
        setRadioStates(createInitialRadioStates());
    }, []);

    const resetAll = useCallback(() => {
        resetBasic();
        resetFeatures();
    }, [resetBasic, resetFeatures]);

    const handleAlphabet = useCallback(() => {
        sampleCounterRef.current += 1;
        const idx = sampleCounterRef.current % ALPHABET_SAMPLES.length;
        setPreviewText(ALPHABET_SAMPLES[idx] ?? "");
    }, []);

    const handleParagraph = useCallback(() => {
        sampleCounterRef.current += 1;
        const idx = sampleCounterRef.current % PARAGRAPH_SAMPLES.length;
        setPreviewText(PARAGRAPH_SAMPLES[idx] ?? "");
    }, []);

    const fontFeaturesString = useMemo(() => {
        const parts: string[] = [];
        for (const group of FEATURE_GROUPS) {
            if (group.type === "radio") {
                const part = buildRadioFeaturePart(group, radioStates);
                if (part !== null) parts.push(part);
            } else {
                parts.push(...buildCheckFeatureParts(group, checkStates));
            }
        }
        return parts.join(", ") || "normal";
    }, [checkStates, radioStates]);

    const bgStyle = useMemo(() => {
        const bgR = Math.round(bgColor.red * 255);
        const bgG = Math.round(bgColor.green * 255);
        const bgB = Math.round(bgColor.blue * 255);
        return css`
            scrolledwindow& {
                background-color: rgb(${bgR}, ${bgG}, ${bgB});
            }
        `;
    }, [bgColor]);

    const previewStyle = useMemo(() => {
        const fontFamily = fontDesc?.getFamily() ?? "Sans";
        const fgR = Math.round(fgColor.red * 255);
        const fgG = Math.round(fgColor.green * 255);
        const fgB = Math.round(fgColor.blue * 255);
        return css`
            label& {
                font-family: "${fontFamily}";
                font-size: ${size}pt;
                color: rgb(${fgR}, ${fgG}, ${fgB});
                letter-spacing: ${letterSpacing / 1024}em;
                line-height: ${lineHeight};
                padding: 16px;
            }
        `;
    }, [fontDesc, size, fgColor, letterSpacing, lineHeight]);

    const editStyle = useMemo(() => {
        const fontFamily = fontDesc?.getFamily() ?? "Sans";
        const fgR = Math.round(fgColor.red * 255);
        const fgG = Math.round(fgColor.green * 255);
        const fgB = Math.round(fgColor.blue * 255);
        return css`
            textview& {
                font-family: "${fontFamily}";
                font-size: ${size}pt;
                font-feature-settings: ${fontFeaturesString};
                color: rgb(${fgR}, ${fgG}, ${fgB});
                letter-spacing: ${letterSpacing / 1024}em;
            }
        `;
    }, [fontDesc, size, fontFeaturesString, fgColor, letterSpacing]);

    const createWaterfallStyle = useCallback(
        (wfSize: number) => {
            const fontFamily = fontDesc?.getFamily() ?? "Sans";
            const fgR = Math.round(fgColor.red * 255);
            const fgG = Math.round(fgColor.green * 255);
            const fgB = Math.round(fgColor.blue * 255);
            return css`
                label& {
                    font-family: "${fontFamily}";
                    font-size: ${wfSize}pt;
                    font-feature-settings: ${fontFeaturesString};
                    color: rgb(${fgR}, ${fgG}, ${fgB});
                    letter-spacing: ${letterSpacing / 1024}em;
                }
            `;
        },
        [fontDesc, fontFeaturesString, fgColor, letterSpacing],
    );

    const settingsText = useMemo(() => {
        if (fontFeaturesString !== "normal") {
            return `font-feature-settings: ${fontFeaturesString};`;
        }
        return "No active settings";
    }, [fontFeaturesString]);

    const pangoFontFeaturesString = useMemo(() => {
        if (fontFeaturesString === "normal") return null;
        return fontFeaturesString.replaceAll('"', "").replaceAll(" 1", "=1").replaceAll(" 0", "=0");
    }, [fontFeaturesString]);

    const applySelectionAttributes = useCallback(() => {
        const label = previewLabelRef.current;
        if (!label) return;

        if (!pangoFontFeaturesString) {
            label.setAttributes(null);
            return;
        }

        const attrList = new Pango.AttrList();

        const [hasSelection, selStart, selEnd] = label.getSelectionBounds();

        const startIndex = hasSelection ? selStart : 0;
        const endIndex = hasSelection ? selEnd : 0xffffffff;

        const attr = Pango.attrFontFeaturesNew(pangoFontFeaturesString);
        attr.startIndex = startIndex;
        attr.endIndex = endIndex;
        attrList.insert(attr);

        label.setAttributes(attrList);
    }, [pangoFontFeaturesString]);

    useLayoutEffect(() => {
        applySelectionAttributes();
    }, [applySelectionAttributes]);

    useEffect(() => {
        const label = previewLabelRef.current;
        if (!label) return;

        const cursorId = label.connect("notify::cursor-position", () => applySelectionAttributes());
        const selectionId = label.connect("notify::selection-bound", () => applySelectionAttributes());

        return () => {
            GObject.signalHandlerDisconnect(label, cursorId);
            GObject.signalHandlerDisconnect(label, selectionId);
        };
    }, [applySelectionAttributes]);

    const descriptionText = useMemo(() => {
        return fontDesc?.toString() ?? "Sans 14";
    }, [fontDesc]);

    const handleSizeEntry = useCallback((entry: Gtk.Entry) => {
        const val = Number.parseFloat(entry.getText());
        if (Number.isFinite(val) && val >= 7 && val <= 100) {
            setSize(val);
        }
    }, []);

    const handleLetterspacingEntry = useCallback((entry: Gtk.Entry) => {
        const val = Number.parseFloat(entry.getText());
        if (Number.isFinite(val) && val >= -1024 && val <= 8192) {
            setLetterSpacing(val);
        }
    }, []);

    const handleLineHeightEntry = useCallback((entry: Gtk.Entry) => {
        const val = Number.parseFloat(entry.getText());
        if (Number.isFinite(val) && val >= 0.75 && val <= 2.5) {
            setLineHeight(val);
        }
    }, []);

    const stackPage = viewMode === "edit" ? "entry" : "label";

    return (
        <>
            <Slot id="titlebar">
                <GtkHeaderBar>
                    <GtkHeaderBar.PackStart>
                        <GtkButton iconName="view-refresh-symbolic" tooltipText="Reset" onClicked={resetAll} />
                    </GtkHeaderBar.PackStart>
                </GtkHeaderBar>
            </Slot>
            <GtkShortcutController scope={Gtk.ShortcutScope.MANAGED}>
                <GtkShortcutController.Shortcut
                    trigger="Escape"
                    onActivate={() => {
                        const tv = editTextViewRef.current;
                        if (tv && viewMode === "edit") {
                            const buffer = tv.getBuffer();
                            buffer.setText(savedTextRef.current, -1);
                        }
                    }}
                />
            </GtkShortcutController>
            <GtkBox ref={containerRef}>
                <GtkScrolledWindow hscrollbarPolicy={Gtk.PolicyType.NEVER}>
                    <GtkViewport cssClasses={["view"]}>
                        <GtkBox
                            orientation={Gtk.Orientation.VERTICAL}
                            spacing={6}
                            marginStart={10}
                            marginEnd={10}
                            marginTop={10}
                            marginBottom={10}
                        >
                            <GtkFontDialogButton
                                fontDesc={fontDesc ?? undefined}
                                onFontDescChanged={(desc) => {
                                    setFontDesc(desc);
                                    if (desc) {
                                        const newSize = desc.getSize() / Pango.SCALE;
                                        if (newSize > 0) setSize(newSize);
                                    }
                                }}
                                receivesDefault
                                level={Gtk.FontLevel.FACE}
                            />
                            <GtkGrid columnSpacing={10} rowSpacing={10}>
                                <GtkGrid.Child column={0} row={0}>
                                    <GtkLabel label="Size" xalign={0} valign={Gtk.Align.BASELINE} />
                                </GtkGrid.Child>
                                <GtkGrid.Child column={1} row={0}>
                                    <GtkScale
                                        hexpand
                                        widthRequest={100}
                                        valign={Gtk.Align.BASELINE}
                                        value={size}
                                        lower={7}
                                        upper={100}
                                        stepIncrement={0.5}
                                        pageIncrement={10}
                                        onValueChanged={setSize}
                                        sensitive={viewMode !== "waterfall"}
                                    />
                                </GtkGrid.Child>
                                <GtkGrid.Child column={2} row={0}>
                                    <GtkEntry
                                        widthChars={4}
                                        maxWidthChars={4}
                                        valign={Gtk.Align.BASELINE}
                                        text={String(Math.round(size * 10) / 10)}
                                        onActivate={handleSizeEntry}
                                        sensitive={viewMode !== "waterfall"}
                                    />
                                </GtkGrid.Child>

                                <GtkGrid.Child column={0} row={1}>
                                    <GtkLabel label="Letterspacing" xalign={0} valign={Gtk.Align.BASELINE} />
                                </GtkGrid.Child>
                                <GtkGrid.Child column={1} row={1}>
                                    <GtkScale
                                        hexpand
                                        widthRequest={100}
                                        valign={Gtk.Align.BASELINE}
                                        value={letterSpacing}
                                        lower={-1024}
                                        upper={8192}
                                        stepIncrement={1}
                                        pageIncrement={512}
                                        onValueChanged={setLetterSpacing}
                                    />
                                </GtkGrid.Child>
                                <GtkGrid.Child column={2} row={1}>
                                    <GtkEntry
                                        widthChars={4}
                                        maxWidthChars={4}
                                        valign={Gtk.Align.BASELINE}
                                        text={String(Math.round(letterSpacing))}
                                        onActivate={handleLetterspacingEntry}
                                    />
                                </GtkGrid.Child>

                                <GtkGrid.Child column={0} row={2}>
                                    <GtkLabel label="Line Height" xalign={0} valign={Gtk.Align.BASELINE} />
                                </GtkGrid.Child>
                                <GtkGrid.Child column={1} row={2}>
                                    <GtkScale
                                        hexpand
                                        widthRequest={100}
                                        valign={Gtk.Align.BASELINE}
                                        value={lineHeight}
                                        lower={0.75}
                                        upper={2.5}
                                        stepIncrement={0.1}
                                        pageIncrement={1}
                                        onValueChanged={setLineHeight}
                                    />
                                </GtkGrid.Child>
                                <GtkGrid.Child column={2} row={2}>
                                    <GtkEntry
                                        widthChars={4}
                                        maxWidthChars={4}
                                        valign={Gtk.Align.BASELINE}
                                        text={String(Math.round(lineHeight * 100) / 100)}
                                        onActivate={handleLineHeightEntry}
                                    />
                                </GtkGrid.Child>

                                <GtkGrid.Child column={0} row={3}>
                                    <GtkLabel label="Foreground" xalign={0} valign={Gtk.Align.BASELINE} />
                                </GtkGrid.Child>
                                <GtkGrid.Child column={1} row={3}>
                                    <GtkColorDialogButton
                                        rgba={fgColor}
                                        onRgbaChanged={setFgColor}
                                        valign={Gtk.Align.BASELINE}
                                    />
                                </GtkGrid.Child>

                                <GtkGrid.Child column={0} row={4}>
                                    <GtkLabel label="Background" xalign={0} valign={Gtk.Align.BASELINE} />
                                </GtkGrid.Child>
                                <GtkGrid.Child column={1} row={4}>
                                    <GtkColorDialogButton
                                        rgba={bgColor}
                                        onRgbaChanged={setBgColor}
                                        valign={Gtk.Align.BASELINE}
                                    />
                                </GtkGrid.Child>

                                <GtkGrid.Child column={2} row={3} rowSpan={2}>
                                    <GtkButton
                                        iconName="object-flip-vertical-symbolic"
                                        halign={Gtk.Align.START}
                                        valign={Gtk.Align.CENTER}
                                        cssClasses={["circular"]}
                                        tooltipText="Swap colors"
                                        onClicked={swapColors}
                                    />
                                </GtkGrid.Child>
                            </GtkGrid>

                            <GtkExpander
                                labelWidget={
                                    <GtkLabel
                                        label="OpenType Features"
                                        xalign={0}
                                        marginTop={10}
                                        marginBottom={10}
                                        cssClasses={["title-4"]}
                                    />
                                }
                            >
                                <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                                    {FEATURE_GROUPS.map((group) => (
                                        <GtkBox
                                            key={group.title}
                                            orientation={Gtk.Orientation.VERTICAL}
                                            halign={Gtk.Align.START}
                                        >
                                            <GtkLabel
                                                label={group.title}
                                                xalign={0}
                                                halign={Gtk.Align.START}
                                                marginTop={10}
                                                marginBottom={10}
                                                cssClasses={["heading"]}
                                            />
                                            {group.type === "radio"
                                                ? group.tags.map((tag) => (
                                                      <GtkCheckButton
                                                          key={tag}
                                                          label={getFeatureDisplayName(tag)}
                                                          active={(radioStates.get(group.title) ?? "xxxx") === tag}
                                                          onToggled={() => selectRadio(group.title, tag)}
                                                      />
                                                  ))
                                                : group.tags.map((tag) => (
                                                      <GtkCheckButton
                                                          key={tag}
                                                          label={getFeatureDisplayName(tag)}
                                                          active={checkStates.get(tag) === "active"}
                                                          inconsistent={checkStates.get(tag) === "inconsistent"}
                                                          onToggled={() => toggleCheck(tag)}
                                                      >
                                                          <GtkGestureClick
                                                              button={3}
                                                              onPressed={() => resetToInconsistent(tag)}
                                                          />
                                                      </GtkCheckButton>
                                                  ))}
                                        </GtkBox>
                                    ))}
                                </GtkBox>
                            </GtkExpander>
                        </GtkBox>
                    </GtkViewport>
                </GtkScrolledWindow>

                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    hexpand
                    vexpand
                    marginStart={20}
                    marginEnd={20}
                    marginTop={20}
                    marginBottom={20}
                    spacing={20}
                >
                    <GtkScrolledWindow vexpand cssClasses={[bgStyle]}>
                        <GtkStack page={stackPage}>
                            <GtkStack.Page id="label">
                                {viewMode === "waterfall" ? (
                                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={4}>
                                        {WATERFALL_SIZES.map((wfSize) => (
                                            <GtkLabel
                                                key={wfSize}
                                                label={previewText}
                                                cssClasses={[createWaterfallStyle(wfSize)]}
                                                wrap
                                                xalign={0}
                                                yalign={0}
                                                valign={Gtk.Align.START}
                                                selectable
                                            />
                                        ))}
                                    </GtkBox>
                                ) : (
                                    <GtkLabel
                                        ref={previewLabelRef}
                                        label={previewText}
                                        cssClasses={[previewStyle]}
                                        wrap
                                        xalign={0}
                                        yalign={0}
                                        valign={Gtk.Align.START}
                                        selectable
                                    />
                                )}
                            </GtkStack.Page>
                            <GtkStack.Page id="entry">
                                <GtkTextView
                                    ref={editTextViewRef}
                                    cssClasses={[editStyle]}
                                    wrapMode={Gtk.WrapMode.WORD}
                                    valign={Gtk.Align.FILL}
                                />
                            </GtkStack.Page>
                        </GtkStack>
                    </GtkScrolledWindow>

                    <GtkBox spacing={10}>
                        <GtkLabel
                            label={settingsText}
                            wrap
                            xalign={0}
                            valign={Gtk.Align.END}
                            widthChars={50}
                            maxWidthChars={50}
                            hexpand
                            cssClasses={["monospace"]}
                        />
                        <GtkButton label="Alphabet" onClicked={handleAlphabet} />
                        <GtkButton label="Paragraph" onClicked={handleParagraph} />
                    </GtkBox>

                    <GtkBox spacing={10}>
                        <GtkLabel
                            label={descriptionText}
                            wrap
                            wrapMode={Pango.WrapMode.CHAR}
                            xalign={0}
                            valign={Gtk.Align.END}
                            widthChars={50}
                            maxWidthChars={50}
                            hexpand
                            cssClasses={["monospace"]}
                        />
                        <GtkBox cssClasses={["linked"]} valign={Gtk.Align.END}>
                            <GtkToggleButton
                                label="Plain"
                                active={viewMode === "plain"}
                                valign={Gtk.Align.BASELINE}
                                onToggled={(btn) => {
                                    if (btn.getActive()) setViewMode("plain");
                                }}
                            />
                            <GtkToggleButton
                                label="Waterfall"
                                active={viewMode === "waterfall"}
                                valign={Gtk.Align.BASELINE}
                                onToggled={(btn) => {
                                    if (btn.getActive()) setViewMode("waterfall");
                                }}
                            />
                        </GtkBox>
                        <GtkToggleButton
                            iconName="document-edit-symbolic"
                            active={viewMode === "edit"}
                            halign={Gtk.Align.END}
                            valign={Gtk.Align.END}
                            tooltipText="Edit text"
                            onToggled={(btn) => {
                                if (btn.getActive()) {
                                    savedTextRef.current = previewText;
                                    setViewMode("edit");
                                }
                            }}
                        />
                    </GtkBox>
                </GtkBox>
            </GtkBox>
        </>
    );
};

export const fontFeaturesDemo: Demo = {
    id: "font-features",
    title: "Pango/Font Explorer",
    description: "Explore OpenType font features and variable font axes",
    keywords: [
        "font",
        "opentype",
        "typography",
        "ligatures",
        "small caps",
        "figures",
        "pango",
        "font-feature-settings",
        "css",
    ],
    component: FontFeaturesDemo,
    sourceCode,
    defaultWidth: 600,
    defaultHeight: 500,
};
