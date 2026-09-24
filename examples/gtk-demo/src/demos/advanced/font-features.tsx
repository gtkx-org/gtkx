import type * as Gdk from "@gtkx/gi/gdk";
import type { RefObject } from "react";
import { css } from "@gtkx/css";
import * as Gtk from "@gtkx/gi/gtk";
import * as Pango from "@gtkx/gi/pango";
import {
    GtkAdjustment,
    GtkBox,
    GtkButton,
    GtkCallbackAction,
    GtkCheckButton,
    GtkColorDialog,
    GtkColorDialogButton,
    GtkEntry,
    GtkExpander,
    GtkFontDialog,
    GtkFontDialogButton,
    GtkGestureClick,
    GtkGrid,
    GtkGridLayoutChild,
    GtkHeaderBar,
    GtkLabel,
    GtkScale,
    GtkScrolledWindow,
    GtkShortcut,
    GtkShortcutController,
    GtkShortcutTrigger,
    GtkStack,
    GtkStackPage,
    GtkTextBuffer,
    GtkTextTag,
    GtkTextView,
    GtkToggleButton,
    GtkViewport,
} from "@gtkx/jsx/gtk";
import { createContext, useContext, useLayoutEffect, useRef, useState } from "react";
import type { Demo, DemoProviderProps } from "../types.js";
import { buildRgba } from "../../build-rgba.js";
import sourceCode from "./font-features.tsx?raw";

type FeatureGroup = {
    title: string;
    type: "check" | "radio";
    tags: string[];
};

type FeatureState = "inconsistent" | "active" | "inactive";
type ViewMode = "plain" | "waterfall" | "edit";

type PreviewSelection = {
    start: number;
    end: number;
};

type NumberBounds = {
    min: number;
    max: number;
};

type PreviewAttributesArgs = {
    fontDesc: Pango.FontDescription;
    letterSpacing: number;
    lineHeight: number;
    fontFeatures: string | null;
    selection: PreviewSelection | null;
};

type WaterfallAttributesArgs = Omit<PreviewAttributesArgs, "selection"> & {
    size: number;
};

type FontFeaturesEditViewProps = {
    textViewRef: RefObject<Gtk.TextView | null>;
    textTagRef: RefObject<Gtk.TextTag | null>;
    fontDesc: Pango.FontDescription;
    fgColor: Gdk.RGBA;
    letterSpacing: number;
    lineHeight: number;
    fontFeatures: string;
};

type FontFeaturesState = ReturnType<typeof useFontFeaturesState>;
type FontFeaturesStyles = ReturnType<typeof useFontFeaturesStyles>;
type FontFeaturesHandlers = ReturnType<typeof useFontFeaturesHandlers>;

type SliderEntryRowProps = {
    row: number;
    label: string;
    entryName: string;
    value: number;
    lower: number;
    upper: number;
    stepIncrement: number;
    pageIncrement: number;
    onValueChanged: (value: number) => void;
    displayText: string;
    onEntryActivate: (entry: Gtk.Entry) => void;
    isSensitive?: boolean;
};

type ColorRowProps = {
    row: number;
    label: string;
    name: string;
    rgba: Gdk.RGBA;
    onChanged: (value: Gdk.RGBA | null) => void;
};

type FeatureGroupBoxProps = {
    group: FeatureGroup;
    checkStates: Map<string, FeatureState>;
    radioStates: Map<string, string>;
    onToggleCheck: (tag: string) => void;
    onResetToInconsistent: (tag: string) => void;
    onSelectRadio: (groupTitle: string, tag: string) => void;
};

type FontFeaturesPreviewProps = {
    state: FontFeaturesState;
    styles: FontFeaturesStyles;
    handlers: FontFeaturesHandlers;
    stackPage: string;
    previewAttributes: Pango.AttrList;
};

type FontFeaturesPreviewLabelProps = {
    state: FontFeaturesState;
    styles: FontFeaturesStyles;
    attributes: Pango.AttrList;
};

type FontFeaturesSectionProps = {
    state: FontFeaturesState;
    handlers: FontFeaturesHandlers;
};

type FontFeaturesContextValue = {
    state: FontFeaturesState;
    styles: FontFeaturesStyles;
    handlers: FontFeaturesHandlers;
};

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

const SS_RE = /^ss(\d{2})$/;
const CV_RE = /^cv(\d{2})$/;
const WATERFALL_SIZES = [7, 8, 9, 10, 12, 14, 16, 20, 24, 30, 40, 50, 60, 70, 90];
const ALPHABET_SAMPLES = ["abcdefghijklmnopqrstuvwxyz", "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "0123456789", "!@#$%^&*/?;"];
const SIZE_BOUNDS: NumberBounds = { min: 7, max: 100 };
const LETTER_SPACING_BOUNDS: NumberBounds = { min: -1, max: 8 };
const LINE_HEIGHT_BOUNDS: NumberBounds = { min: 0.75, max: 2.5 };

const ENGLISH_PARAGRAPH =
    "Grumpy wizards make toxic brew for the evil Queen and Jack. " +
    "A quick movement of the enemy will jeopardize six gunboats. " +
    "The job of waxing linoleum frequently peeves chintzy kids. " +
    "My girl wove six dozen plaid jackets before she quit. " +
    "Twelve ziggurats quickly jumped a finch box.";

const RUSSIAN_PARAGRAPH =
    "Разъяренный чтец эгоистично бьёт пятью жердями шустрого фехтовальщика. " +
    "Наш банк вчера же выплатил Ф.Я. Эйхгольду комиссию за ценные вещи. " +
    "Эх, чужак, общий съём цен шляп (юфть) – вдрызг! " +
    "В чащах юга жил бы цитрус? Да, но фальшивый экземпляр!";

const GREEK_PARAGRAPH = "Τάχιστη αλώπηξ βαφής ψημένη γη, δρασκελίζει υπέρ νωθρού κυνός";
const PARAGRAPH_SAMPLES = [ENGLISH_PARAGRAPH, RUSSIAN_PARAGRAPH, GREEK_PARAGRAPH];
const INITIAL_PREVIEW_TEXT = PARAGRAPH_SAMPLES.join("\n\n");
const UTF8_ENCODER = new TextEncoder();
const FontFeaturesContext = createContext<FontFeaturesContextValue | null>(null);

const fontFeaturesDemo: Demo = {
    id: "font-features",
    title: "Pango/Font Explorer",
    description:
        "This example applies a fixed set of common OpenType features with Pango attributes. " +
        "Choose a font, adjust its presentation, and compare the plain, waterfall, and editable previews.",
    keywords: [],
    component: FontFeaturesDemo,
    titlebar: FontFeaturesTitlebar,
    provider: FontFeaturesProvider,
    sourceCode,
    defaultWidth: 600,
    defaultHeight: 500,
};

const buildNumberedFeatureName = (tag: string, pattern: RegExp, label: string): string | null => {
    const match = pattern.exec(tag);

    if (!match) {
        return null;
    }

    return `${label} ${String(Number(match[1] ?? "0"))}`;
};

const getFeatureDisplayName = (tag: string): string => {
    if (tag === "xxxx") {
        return "Default";
    }

    const stylisticSet = buildNumberedFeatureName(tag, SS_RE, "Stylistic Set");

    if (stylisticSet !== null) {
        return stylisticSet;
    }

    const characterVariant = buildNumberedFeatureName(tag, CV_RE, "Character Variant");

    return characterVariant ?? FEATURE_DISPLAY_NAMES[tag] ?? tag;
};

const buildRadioFeaturePart = (group: { title: string }, radioStates: Map<string, string>): string | null => {
    const selected = radioStates.get(group.title) ?? "xxxx";

    return selected === "xxxx" ? null : `"${selected}" 1`;
};

const buildCheckFeaturePart = (tag: string, checkStates: Map<string, FeatureState>): string | null => {
    const state = checkStates.get(tag) ?? "inconsistent";

    if (state === "inconsistent") {
        return null;
    }

    return `"${tag}" ${state === "active" ? "1" : "0"}`;
};

const buildCheckFeatureParts = (group: { tags: string[] }, checkStates: Map<string, FeatureState>): string[] =>
    group.tags
        .map((tag) => buildCheckFeaturePart(tag, checkStates))
        .filter((part): part is string => part !== null);

const createDefaultFgColor = () => buildRgba(0, 0, 0, 1);
const createDefaultBgColor = () => buildRgba(1, 1, 1, 1);
const createDefaultFontDesc = () => Pango.FontDescription.fromString("Sans 14");

const fontDescriptionWithSize = (fontDesc: Pango.FontDescription, size: number): Pango.FontDescription => {
    const next = Pango.FontDescription.new();
    next.merge(fontDesc, true);
    next.setSize(Pango.unitsFromDouble(size));

    return next;
};

const collectCheckTags = (): string[] =>
    FEATURE_GROUPS.filter((group) => group.type === "check").flatMap((group) => group.tags);

const createInitialCheckStates = (): Map<string, FeatureState> => {
    const states: Map<string, FeatureState> = new Map();

    for (const tag of collectCheckTags()) {
        states.set(tag, "inconsistent");
    }

    return states;
};

const createInitialRadioStates = (): Map<string, string> => {
    const states: Map<string, string> = new Map();

    for (const group of FEATURE_GROUPS) {
        if (group.type === "radio") {
            states.set(group.title, "xxxx");
        }
    }

    return states;
};

function useFontFeaturesState() {
    const [fontDesc, setFontDesc] = useState(createDefaultFontDesc);
    const [checkStates, setCheckStates] = useState<Map<string, FeatureState>>(createInitialCheckStates);
    const [radioStates, setRadioStates] = useState<Map<string, string>>(createInitialRadioStates);
    const [fgColor, setFgColor] = useState<Gdk.RGBA>(createDefaultFgColor);
    const [bgColor, setBgColor] = useState<Gdk.RGBA>(createDefaultBgColor);
    const [letterSpacing, setLetterSpacing] = useState(0);
    const [lineHeight, setLineHeight] = useState(1);
    const [viewMode, setViewMode] = useState<ViewMode>("plain");
    const [previewText, setPreviewText] = useState(INITIAL_PREVIEW_TEXT);
    const [previewSelection, setPreviewSelection] = useState<PreviewSelection | null>(null);
    const sampleCounterRef = useRef(0);
    const savedTextRef = useRef("");
    const previewLabelRef = useRef<Gtk.Label | null>(null);
    const editTextViewRef = useRef<Gtk.TextView | null>(null);
    const editTextTagRef = useRef<Gtk.TextTag | null>(null);
    const editScrolledWindowRef = useRef<Gtk.ScrolledWindow | null>(null);
    const size = Pango.unitsToDouble(fontDesc.getSize());

    const setSize = (nextSize: number) => {
        setFontDesc((current) =>
            Pango.unitsToDouble(current.getSize()) === nextSize ? current : fontDescriptionWithSize(current, nextSize));
    };

    return {
        fontDesc, setFontDesc,
        checkStates, setCheckStates,
        radioStates, setRadioStates,
        fgColor, setFgColor,
        bgColor, setBgColor,
        size, setSize,
        letterSpacing, setLetterSpacing,
        lineHeight, setLineHeight,
        viewMode, setViewMode,
        previewText, setPreviewText,
        previewSelection, setPreviewSelection,
        sampleCounterRef, savedTextRef,
        previewLabelRef, editTextViewRef,
        editTextTagRef, editScrolledWindowRef,
    };
}

const buildGroupFeatureParts = (
    group: FeatureGroup,
    checkStates: Map<string, FeatureState>,
    radioStates: Map<string, string>,
): string[] => {
    if (group.type === "check") {
        return buildCheckFeatureParts(group, checkStates);
    }

    const part = buildRadioFeaturePart(group, radioStates);

    return part === null ? [] : [part];
};

const buildFontFeaturesString = (checkStates: Map<string, FeatureState>, radioStates: Map<string, string>) => {
    const parts = FEATURE_GROUPS.flatMap((group) => buildGroupFeatureParts(group, checkStates, radioStates));

    return parts.join(", ") || "normal";
};

const rgbColor = (color: Gdk.RGBA) => ({
    r: Math.round(color.red * 255),
    g: Math.round(color.green * 255),
    b: Math.round(color.blue * 255),
});

const buildBgStyle = (bgColor: Gdk.RGBA) => {
    const { r, g, b } = rgbColor(bgColor);

    return css`
        scrolledwindow& {
            background-color: rgb(${r}, ${g}, ${b});
        }
    `;
};

const buildLabelStyle = (fgColor: Gdk.RGBA, padding = 0) => {
    const { r, g, b } = rgbColor(fgColor);

    return css`
        label& {
            color: rgb(${r}, ${g}, ${b});
            padding: ${padding}px;
        }
    `;
};

function useFontFeaturesStyles(state: ReturnType<typeof useFontFeaturesState>) {
    const { fontDesc, fgColor, bgColor, checkStates, radioStates } = state;
    const fontFeaturesString = buildFontFeaturesString(checkStates, radioStates);
    const bgStyle = buildBgStyle(bgColor);
    const previewStyle = buildLabelStyle(fgColor, 16);
    const waterfallStyle = buildLabelStyle(fgColor);

    const pangoFontFeaturesString = (() => {
        if (fontFeaturesString === "normal") {
            return null;
        }

        return fontFeaturesString.replaceAll('"', "").replaceAll(" 1", "=1").replaceAll(" 0", "=0");
    })();

    const settingsText = pangoFontFeaturesString ?? "";
    const descriptionText = fontDesc.toString();

    return {
        bgStyle,
        previewStyle,
        waterfallStyle,
        settingsText,
        pangoFontFeaturesString,
        descriptionText,
    };
}

const mapWith = <T,>(entries: Map<string, T>, key: string, value: T): Map<string, T> => {
    const next = new Map(entries);
    next.set(key, value);

    return next;
};

function useFeatureHandlers(state: ReturnType<typeof useFontFeaturesState>) {
    const { setCheckStates, setRadioStates, previewLabelRef, setPreviewSelection } = state;

    const captureSelection = () => {
        setPreviewSelection(readPreviewSelection(previewLabelRef.current));
    };

    const toggleCheck = (tag: string) => {
        captureSelection();
        setCheckStates((prev) => mapWith(prev, tag, prev.get(tag) === "active" ? "inactive" : "active"));
    };

    const resetToInconsistent = (tag: string) => {
        captureSelection();
        setCheckStates((prev) => mapWith(prev, tag, "inconsistent"));
    };

    const selectRadio = (groupTitle: string, tag: string) => {
        captureSelection();
        setRadioStates((prev) => mapWith(prev, groupTitle, tag));
    };

    const resetFeatures = () => {
        previewLabelRef.current?.selectRegion(0, 0);
        setPreviewSelection(null);
        setCheckStates(createInitialCheckStates());
        setRadioStates(createInitialRadioStates());
    };

    return { toggleCheck, resetToInconsistent, selectRadio, resetFeatures };
}

function useColorHandlers(state: ReturnType<typeof useFontFeaturesState>) {
    const { fgColor, bgColor, setFgColor, setBgColor, setFontDesc, setLetterSpacing, setLineHeight } = state;

    const swapColors = () => {
        setFgColor(buildRgba(bgColor.red, bgColor.green, bgColor.blue, 1));
        setBgColor(buildRgba(fgColor.red, fgColor.green, fgColor.blue, 1));
    };

    const resetBasic = () => {
        setFontDesc(createDefaultFontDesc());
        setLetterSpacing(0);
        setLineHeight(1);
        setFgColor(createDefaultFgColor());
        setBgColor(createDefaultBgColor());
    };

    return { swapColors, resetBasic };
}

function useSampleHandlers(state: ReturnType<typeof useFontFeaturesState>) {
    const { sampleCounterRef, setPreviewText, editTextViewRef } = state;

    const updatePreviewText = (text: string) => {
        setPreviewText(text);
        const tv = editTextViewRef.current;

        if (tv) {
            tv.getBuffer().setText(text, -1);
        }
    };

    const handleAlphabet = () => {
        sampleCounterRef.current += 1;
        const idx = sampleCounterRef.current % ALPHABET_SAMPLES.length;
        updatePreviewText(ALPHABET_SAMPLES[idx] ?? "");
    };

    const handleParagraph = () => {
        sampleCounterRef.current += 1;
        const idx = sampleCounterRef.current % PARAGRAPH_SAMPLES.length;
        updatePreviewText(PARAGRAPH_SAMPLES[idx] ?? "");
    };

    return { handleAlphabet, handleParagraph };
}

const applyEntryNumber = (entry: Gtk.Entry, bounds: NumberBounds, apply: (value: number) => void) => {
    const text = entry.getText().trim();
    const value = text === "" ? NaN : Number(text);

    if (Number.isFinite(value) && value >= bounds.min && value <= bounds.max) {
        apply(value);
    }
};

function useEntryHandlers(state: ReturnType<typeof useFontFeaturesState>) {
    const { setSize, setLetterSpacing, setLineHeight } = state;

    const handleSizeEntry = (entry: Gtk.Entry) => {
        applyEntryNumber(entry, SIZE_BOUNDS, setSize);
    };

    const handleLetterspacingEntry = (entry: Gtk.Entry) => {
        applyEntryNumber(entry, LETTER_SPACING_BOUNDS, setLetterSpacing);
    };

    const handleLineHeightEntry = (entry: Gtk.Entry) => {
        applyEntryNumber(entry, LINE_HEIGHT_BOUNDS, setLineHeight);
    };

    return { handleSizeEntry, handleLetterspacingEntry, handleLineHeightEntry };
}

function useFontFeaturesHandlers(state: ReturnType<typeof useFontFeaturesState>) {
    const featureHandlers = useFeatureHandlers(state);
    const colorHandlers = useColorHandlers(state);
    const sampleHandlers = useSampleHandlers(state);
    const entryHandlers = useEntryHandlers(state);

    const resetAll = () => {
        colorHandlers.resetBasic();
        featureHandlers.resetFeatures();
    };

    return {
        ...featureHandlers,
        ...colorHandlers,
        ...sampleHandlers,
        ...entryHandlers,
        resetAll,
    };
}

const charOffsetToByteOffset = (text: string, charOffset: number): number => {
    let byteOffset = 0;
    let charCount = 0;

    for (const char of text) {
        if (charCount >= charOffset) {
            break;
        }

        byteOffset += UTF8_ENCODER.encode(char).length;
        charCount += 1;
    }

    return byteOffset;
};

const readPreviewSelection = (label: Gtk.Label | null): PreviewSelection | null => {
    if (!label) {
        return null;
    }

    const [hasSelection, selectionStart, selectionEnd] = label.getSelectionBounds();

    if (!hasSelection) {
        return null;
    }

    const text = label.getText();

    return {
        start: charOffsetToByteOffset(text, selectionStart),
        end: charOffsetToByteOffset(text, selectionEnd),
    };
};

const createPreviewAttributes = ({
    fontDesc,
    letterSpacing,
    lineHeight,
    fontFeatures,
    selection,
}: PreviewAttributesArgs): Pango.AttrList => {
    const attrList = Pango.AttrList.new();
    attrList.insert(Pango.AttrFontDesc.new(fontDesc));
    attrList.insert(Pango.attrLetterSpacingNew(Pango.unitsFromDouble(letterSpacing)));
    attrList.insert(Pango.attrLineHeightNew(lineHeight));

    if (fontFeatures) {
        const attr = Pango.AttrFontFeatures.new(fontFeatures);
        attr.startIndex = selection?.start ?? Pango.ATTR_INDEX_FROM_TEXT_BEGINNING;
        attr.endIndex = selection?.end ?? Pango.ATTR_INDEX_TO_TEXT_END;
        attrList.insert(attr);
    }

    return attrList;
};

const createWaterfallAttributes = ({
    fontDesc,
    size,
    letterSpacing,
    lineHeight,
    fontFeatures,
}: WaterfallAttributesArgs): Pango.AttrList => {
    const waterfallFontDesc = fontDescriptionWithSize(fontDesc, size);

    return createPreviewAttributes({
        fontDesc: waterfallFontDesc,
        letterSpacing,
        lineHeight,
        fontFeatures,
        selection: null,
    });
};

const FontFeaturesFontButton = ({ state }: { state: FontFeaturesState }) => {
    const { fontDesc, setFontDesc } = state;

    return (
        <GtkFontDialogButton
            name="font-button"
            accessibleLabel="Font"
            fontDesc={fontDesc}
            dialog={<GtkFontDialog />}
            onNotifyFontDesc={(desc) => {
                if (!desc) {
                    return;
                }

                const next = fontDescriptionWithSize(desc, Pango.unitsToDouble(fontDesc.getSize()));

                if (!fontDesc.equal(next)) {
                    setFontDesc(next);
                }
            }}
            receivesDefault
            level={Gtk.FontLevel.FACE}
        />
    );
};

const FontFeaturesGrid = ({ state, handlers }: FontFeaturesSectionProps) => {
    const { size, letterSpacing, lineHeight, viewMode } = state;
    const { setSize, setLetterSpacing, setLineHeight } = state;

    return (
        <GtkGrid columnSpacing={10} rowSpacing={10}>
            <SliderEntryRow
                row={0}
                label="Size"
                entryName="size_entry"
                value={size}
                lower={SIZE_BOUNDS.min}
                upper={SIZE_BOUNDS.max}
                stepIncrement={0.5}
                pageIncrement={10}
                onValueChanged={setSize}
                displayText={String(Math.round(size * 10) / 10)}
                onEntryActivate={handlers.handleSizeEntry}
                isSensitive={viewMode !== "waterfall"}
            />
            <SliderEntryRow
                row={1}
                label="Letterspacing"
                entryName="letterspacing_entry"
                value={letterSpacing}
                lower={LETTER_SPACING_BOUNDS.min}
                upper={LETTER_SPACING_BOUNDS.max}
                stepIncrement={0.1}
                pageIncrement={1}
                onValueChanged={setLetterSpacing}
                displayText={String(Math.round(letterSpacing * 100) / 100)}
                onEntryActivate={handlers.handleLetterspacingEntry}
            />
            <SliderEntryRow
                row={2}
                label="Line Height"
                entryName="line_height_entry"
                value={lineHeight}
                lower={LINE_HEIGHT_BOUNDS.min}
                upper={LINE_HEIGHT_BOUNDS.max}
                stepIncrement={0.1}
                pageIncrement={1}
                onValueChanged={setLineHeight}
                displayText={String(Math.round(lineHeight * 100) / 100)}
                onEntryActivate={handlers.handleLineHeightEntry}
            />

            <FontFeaturesColorRows state={state} handlers={handlers} />
        </GtkGrid>
    );
};

const applyRgba = (value: Gdk.RGBA | null, apply: (color: Gdk.RGBA) => void) => {
    if (value) {
        apply(value);
    }
};

const ColorRow = ({ row, label, name, rgba, onChanged }: ColorRowProps) => (
    <>
        <GtkGridLayoutChild column={0} row={row}>
            <GtkLabel xalign={0} valign={Gtk.Align.BASELINE_FILL}>
                {label}
            </GtkLabel>
        </GtkGridLayoutChild>
        <GtkGridLayoutChild column={1} row={row}>
            <GtkColorDialogButton
                name={name}
                accessibleLabel={label}
                rgba={rgba}
                dialog={<GtkColorDialog />}
                onNotifyRgba={onChanged}
                valign={Gtk.Align.BASELINE_FILL}
            />
        </GtkGridLayoutChild>
    </>
);

const FontFeaturesColorRows = ({ state, handlers }: FontFeaturesSectionProps) => {
    const { fgColor, setFgColor, bgColor, setBgColor } = state;

    const handleForegroundChanged = (value: Gdk.RGBA | null) => {
        applyRgba(value, setFgColor);
    };

    const handleBackgroundChanged = (value: Gdk.RGBA | null) => {
        applyRgba(value, setBgColor);
    };

    return (
        <>
            <ColorRow
                row={3}
                label="Foreground"
                name="foreground-color"
                rgba={fgColor}
                onChanged={handleForegroundChanged}
            />
            <ColorRow
                row={4}
                label="Background"
                name="background-color"
                rgba={bgColor}
                onChanged={handleBackgroundChanged}
            />

            <GtkGridLayoutChild column={2} row={3} rowSpan={2}>
                <GtkButton
                    name="swap-colors"
                    accessibleLabel="Swap colors"
                    iconName="object-flip-vertical-symbolic"
                    halign={Gtk.Align.START}
                    valign={Gtk.Align.CENTER}
                    cssClasses={["circular"]}
                    tooltipText="Swap colors"
                    onClicked={handlers.swapColors}
                />
            </GtkGridLayoutChild>
        </>
    );
};

const SliderScaleCell = (props: SliderEntryRowProps) => (
    <GtkGridLayoutChild column={1} row={props.row}>
        <GtkScale
            name={`${props.entryName}_scale`}
            accessibleLabel={props.label}
            hexpand
            widthRequest={100}
            valign={Gtk.Align.BASELINE_FILL}
            adjustment={(
                <GtkAdjustment
                    value={props.value}
                    lower={props.lower}
                    upper={props.upper}
                    stepIncrement={props.stepIncrement}
                    pageIncrement={props.pageIncrement}
                />
            )}
            onValueChanged={(scale) => {
                props.onValueChanged(scale.getValue());
            }}
            sensitive={props.isSensitive}
        />
    </GtkGridLayoutChild>
);

const SliderEntryRow = (props: SliderEntryRowProps) => (
    <>
        <GtkGridLayoutChild column={0} row={props.row}>
            <GtkLabel xalign={0} valign={Gtk.Align.BASELINE_FILL}>
                {props.label}
            </GtkLabel>
        </GtkGridLayoutChild>
        <SliderScaleCell {...props} />
        <GtkGridLayoutChild column={2} row={props.row}>
            <GtkEntry
                name={props.entryName}
                accessibleLabel={props.label}
                widthChars={4}
                maxWidthChars={4}
                valign={Gtk.Align.BASELINE_FILL}
                text={props.displayText}
                onActivate={props.onEntryActivate}
                sensitive={props.isSensitive}
            />
        </GtkGridLayoutChild>
    </>
);

const FontFeaturesExpander = ({ state, handlers }: FontFeaturesSectionProps) => {
    const { checkStates, radioStates } = state;

    return (
        <GtkExpander
            name="features-expander"
            labelWidget={(
                <GtkLabel xalign={0} marginTop={10} marginBottom={10} cssClasses={["title-4"]}>
                    OpenType Features
                </GtkLabel>
            )}
        >
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                {FEATURE_GROUPS.map((group) => (
                    <FeatureGroupBox
                        key={group.title}
                        group={group}
                        checkStates={checkStates}
                        radioStates={radioStates}
                        onToggleCheck={handlers.toggleCheck}
                        onResetToInconsistent={handlers.resetToInconsistent}
                        onSelectRadio={handlers.selectRadio}
                    />
                ))}
            </GtkBox>
        </GtkExpander>
    );
};

const FontFeaturesSidebar = ({ state, handlers }: FontFeaturesSectionProps) => (
    <GtkBox
        orientation={Gtk.Orientation.VERTICAL}
        spacing={6}
        marginStart={10}
        marginEnd={10}
        marginTop={10}
        marginBottom={10}
    >
        <FontFeaturesFontButton state={state} />
        <FontFeaturesGrid state={state} handlers={handlers} />
        <FontFeaturesExpander state={state} handlers={handlers} />
    </GtkBox>
);

const FeatureRadioGroup = ({
    group,
    radioStates,
    onSelectRadio,
}: Pick<FeatureGroupBoxProps, "group" | "radioStates" | "onSelectRadio">) => {
    const [groupButton, setGroupButton] = useState<Gtk.CheckButton | null>(null);

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            accessibleRole={Gtk.AccessibleRole.RADIO_GROUP}
            accessibleLabel={group.title}
        >
            {group.tags.map((tag, index) => (
                <GtkCheckButton
                    key={tag}
                    ref={index === 0 ? setGroupButton : undefined}
                    group={index === 0 ? undefined : groupButton}
                    accessibleRole={Gtk.AccessibleRole.RADIO}
                    label={getFeatureDisplayName(tag)}
                    active={(radioStates.get(group.title) ?? "xxxx") === tag}
                    onToggled={(button) => {
                        if (button.getActive()) {
                            onSelectRadio(group.title, tag);
                        }
                    }}
                />
            ))}
        </GtkBox>
    );
};

const FeatureGroupBox = ({
    group,
    checkStates,
    radioStates,
    onToggleCheck,
    onResetToInconsistent,
    onSelectRadio,
}: FeatureGroupBoxProps) => (
    <GtkBox orientation={Gtk.Orientation.VERTICAL} halign={Gtk.Align.START}>
        <GtkLabel xalign={0} halign={Gtk.Align.START} marginTop={10} marginBottom={10} cssClasses={["heading"]}>
            {group.title}
        </GtkLabel>
        {group.type === "radio"
            ? <FeatureRadioGroup group={group} radioStates={radioStates} onSelectRadio={onSelectRadio} />
            : group.tags.map((tag) => (
                    <GtkCheckButton
                        key={tag}
                        label={getFeatureDisplayName(tag)}
                        active={checkStates.get(tag) === "active"}
                        inconsistent={checkStates.get(tag) === "inconsistent"}
                        onToggled={() => {
                            onToggleCheck(tag);
                        }}
                        controllers={(
                            <GtkGestureClick
                                button={3}
                                onPressed={() => {
                                    onResetToInconsistent(tag);
                                }}
                            />
                        )}
                    />
                ))}
    </GtkBox>
);

const FontFeaturesPreviewLabel = ({ state, styles, attributes }: FontFeaturesPreviewLabelProps) => {
    const { fontDesc, letterSpacing, lineHeight, previewText, previewLabelRef, viewMode } = state;
    const { previewStyle, waterfallStyle, pangoFontFeaturesString } = styles;

    if (viewMode === "waterfall") {
        return (
            <GtkBox name="waterfall-box" orientation={Gtk.Orientation.VERTICAL} spacing={4}>
                {WATERFALL_SIZES.map((wfSize) => (
                    <GtkLabel
                        key={wfSize}
                        name="waterfall-label"
                        attributes={createWaterfallAttributes({
                            fontDesc,
                            size: wfSize,
                            letterSpacing,
                            lineHeight,
                            fontFeatures: pangoFontFeaturesString,
                        })}
                        cssClasses={[waterfallStyle]}
                        wrap
                        xalign={0}
                        yalign={0}
                        valign={Gtk.Align.START}
                        selectable
                    >
                        {previewText}
                    </GtkLabel>
                ))}
            </GtkBox>
        );
    }

    return (
        <GtkLabel
            name="preview-label"
            ref={previewLabelRef}
            attributes={attributes}
            cssClasses={[previewStyle]}
            wrap
            xalign={0}
            yalign={0}
            valign={Gtk.Align.START}
            selectable
        >
            {previewText}
        </GtkLabel>
    );
};

const FontFeaturesPreviewSettingsRow = ({
    styles,
    handlers,
}: {
    styles: FontFeaturesStyles;
    handlers: FontFeaturesHandlers;
}) => (
    <GtkBox spacing={10}>
        <GtkLabel
            name="settings"
            wrap
            xalign={0}
            valign={Gtk.Align.END}
            widthChars={50}
            maxWidthChars={50}
            hexpand
            cssClasses={["monospace"]}
        >
            {styles.settingsText}
        </GtkLabel>
        <GtkButton label="Alphabet" onClicked={handlers.handleAlphabet} />
        <GtkButton label="Paragraph" onClicked={handlers.handleParagraph} />
    </GtkBox>
);

function useViewModeToggleHandlers(state: FontFeaturesState) {
    const { viewMode, previewText, setPreviewText, setViewMode, savedTextRef, editTextViewRef } = state;

    const commitEditedText = () => {
        const buffer = editTextViewRef.current?.getBuffer();

        if (buffer) {
            setPreviewText(buffer.getText(buffer.getStartIter(), buffer.getEndIter(), false));
        }
    };

    const handlePlainToggled = (btn: Gtk.ToggleButton) => {
        if (!btn.getActive()) {
            return;
        }

        if (viewMode === "edit") {
            commitEditedText();
        }

        setViewMode("plain");
    };

    const handleWaterfallToggled = (btn: Gtk.ToggleButton) => {
        if (!btn.getActive()) {
            return;
        }

        if (viewMode === "edit") {
            commitEditedText();
        }

        setViewMode("waterfall");
    };

    const handleEditToggled = (btn: Gtk.ToggleButton) => {
        if (!btn.getActive()) {
            return;
        }

        savedTextRef.current = previewText;
        editTextViewRef.current?.getBuffer().setText(previewText, -1);
        setViewMode("edit");
    };

    return { handlePlainToggled, handleWaterfallToggled, handleEditToggled };
}

const FontFeaturesDescriptionLabel = ({ text }: { text: string }) => (
    <GtkLabel
        name="font-description"
        accessibleLabel="Font description"
        wrap
        wrapMode={Pango.WrapMode.CHAR}
        xalign={0}
        valign={Gtk.Align.END}
        widthChars={50}
        maxWidthChars={50}
        hexpand
        cssClasses={["monospace"]}
    >
        {text}
    </GtkLabel>
);

const FontFeaturesPreviewControlsRow = ({
    state,
    styles,
}: {
    state: FontFeaturesState;
    styles: FontFeaturesStyles;
}) => {
    const { viewMode } = state;
    const [plainToggle, setPlainToggle] = useState<Gtk.ToggleButton | null>(null);
    const { handlePlainToggled, handleWaterfallToggled, handleEditToggled } = useViewModeToggleHandlers(state);

    return (
        <GtkBox spacing={10}>
            <FontFeaturesDescriptionLabel text={styles.descriptionText} />
            <GtkBox cssClasses={["linked"]} valign={Gtk.Align.END}>
                <GtkToggleButton
                    ref={setPlainToggle}
                    name="plain_toggle"
                    label="Plain"
                    active={viewMode === "plain"}
                    valign={Gtk.Align.BASELINE_FILL}
                    onToggled={handlePlainToggled}
                />
                <GtkToggleButton
                    name="waterfall_toggle"
                    label="Waterfall"
                    group={plainToggle}
                    active={viewMode === "waterfall"}
                    valign={Gtk.Align.BASELINE_FILL}
                    onToggled={handleWaterfallToggled}
                />
            </GtkBox>
            <GtkToggleButton
                name="edit_toggle"
                accessibleLabel="Edit text"
                iconName="document-edit-symbolic"
                group={plainToggle}
                active={viewMode === "edit"}
                halign={Gtk.Align.END}
                valign={Gtk.Align.END}
                tooltipText="Edit text"
                onToggled={handleEditToggled}
            />
        </GtkBox>
    );
};

const FontFeaturesEditView = ({
    textViewRef,
    textTagRef,
    fontDesc,
    fgColor,
    letterSpacing,
    lineHeight,
    fontFeatures,
}: FontFeaturesEditViewProps) => {
    const applyEditTag = (buffer: Gtk.TextBuffer) => {
        const tag = textTagRef.current;

        if (tag) {
            buffer.applyTag(tag, buffer.getStartIter(), buffer.getEndIter());
        }
    };

    return (
        <GtkTextView
            name="edit_textview"
            accessibleLabel="Preview text editor"
            ref={textViewRef}
            wrapMode={Gtk.WrapMode.WORD}
            valign={Gtk.Align.FILL}
            buffer={(
                <GtkTextBuffer onChanged={applyEditTag}>
                    <GtkTextTag
                        ref={textTagRef}
                        fontDesc={fontDesc}
                        foregroundRgba={fgColor}
                        letterSpacing={Pango.unitsFromDouble(letterSpacing)}
                        lineHeight={lineHeight}
                        fontFeatures={fontFeatures}
                    />
                </GtkTextBuffer>
            )}
        />
    );
};

const FontFeaturesPreview = (props: FontFeaturesPreviewProps) => {
    const { state, styles, handlers, stackPage, previewAttributes } = props;
    const {
        editScrolledWindowRef,
        editTextViewRef,
        editTextTagRef,
        fontDesc,
        fgColor,
        letterSpacing,
        lineHeight,
    } = state;
    const { bgStyle, pangoFontFeaturesString } = styles;

    return (
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
            <GtkScrolledWindow ref={editScrolledWindowRef} vexpand propagateNaturalHeight cssClasses={[bgStyle]}>
                <GtkStack name="stack" visibleChildName={stackPage}>
                    <GtkStackPage name="label">
                        <FontFeaturesPreviewLabel state={state} styles={styles} attributes={previewAttributes} />
                    </GtkStackPage>
                    <GtkStackPage name="entry">
                        <FontFeaturesEditView
                            textViewRef={editTextViewRef}
                            textTagRef={editTextTagRef}
                            fontDesc={fontDesc}
                            fgColor={fgColor}
                            letterSpacing={letterSpacing}
                            lineHeight={lineHeight}
                            fontFeatures={pangoFontFeaturesString ?? ""}
                        />
                    </GtkStackPage>
                </GtkStack>
            </GtkScrolledWindow>

            <FontFeaturesPreviewSettingsRow styles={styles} handlers={handlers} />
            <FontFeaturesPreviewControlsRow state={state} styles={styles} />
        </GtkBox>
    );
};

const useFontFeatures = (): FontFeaturesContextValue => {
    const ctx = useContext(FontFeaturesContext);

    if (!ctx) {
        throw new Error("useFontFeatures must be used inside a FontFeaturesProvider");
    }

    return ctx;
};

function useEditViewFocus(state: FontFeaturesState) {
    const { viewMode, editTextViewRef, editScrolledWindowRef } = state;

    useLayoutEffect(() => {
        if (viewMode !== "edit") {
            return;
        }

        const tv = editTextViewRef.current;

        if (!tv) {
            return;
        }

        editScrolledWindowRef.current?.getVadjustment().setValue(0);
        tv.grabFocus();
    }, [viewMode, editTextViewRef, editScrolledWindowRef]);
}

const didHandleEscape = (state: FontFeaturesState): boolean => {
    if (state.viewMode !== "edit") {
        return false;
    }

    const tv = state.editTextViewRef.current;

    if (tv) {
        const buffer = tv.getBuffer();
        buffer.setText(state.savedTextRef.current, -1);
    }

    state.setPreviewText(state.savedTextRef.current);
    state.setViewMode("plain");

    return true;
};

const FontFeaturesEscapeController = ({ state }: { state: FontFeaturesState }) => (
    <GtkShortcutController
        scope={Gtk.ShortcutScope.MANAGED}
        shortcuts={(
            <GtkShortcut
                trigger={<GtkShortcutTrigger accelerator="Escape" />}
                action={<GtkCallbackAction callback={() => didHandleEscape(state)} />}
            />
        )}
    />
);

function FontFeaturesProvider({ children }: DemoProviderProps) {
    const state = useFontFeaturesState();
    const styles = useFontFeaturesStyles(state);
    const handlers = useFontFeaturesHandlers(state);

    const value = {
        state,
        styles,
        handlers,
    };

    return <FontFeaturesContext.Provider value={value}>{children}</FontFeaturesContext.Provider>;
}

function FontFeaturesTitlebar() {
    const { handlers } = useFontFeatures();

    return (
        <GtkHeaderBar
            name="font-features-header"
            start={(
                <GtkButton
                    name="reset"
                    accessibleLabel="Reset"
                    iconName="view-refresh-symbolic"
                    tooltipText="Reset"
                    onClicked={handlers.resetAll}
                />
            )}
        />
    );
}

function FontFeaturesDemo() {
    const { state, styles, handlers } = useFontFeatures();
    useEditViewFocus(state);
    const previewAttributes = createPreviewAttributes({
        fontDesc: state.fontDesc,
        letterSpacing: state.letterSpacing,
        lineHeight: state.lineHeight,
        fontFeatures: styles.pangoFontFeaturesString,
        selection: state.previewSelection,
    });
    const stackPage = state.viewMode === "edit" ? "entry" : "label";

    return (
        <GtkBox controllers={<FontFeaturesEscapeController state={state} />}>
            <GtkScrolledWindow hscrollbarPolicy={Gtk.PolicyType.NEVER}>
                <GtkViewport cssClasses={["view"]}>
                    <FontFeaturesSidebar state={state} handlers={handlers} />
                </GtkViewport>
            </GtkScrolledWindow>

            <FontFeaturesPreview
                state={state}
                styles={styles}
                handlers={handlers}
                stackPage={stackPage}
                previewAttributes={previewAttributes}
            />
        </GtkBox>
    );
}

export { fontFeaturesDemo };
