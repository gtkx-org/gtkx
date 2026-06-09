import { css } from "@gtkx/css";
import * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";
import * as Pango from "@gtkx/gi/pango";
import { useAdjustment } from "@gtkx/react";
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
    GtkGridChild,
    GtkHeaderBar,
    GtkLabel,
    GtkScale,
    GtkScrolledWindow,
    GtkShortcut,
    GtkShortcutController,
    GtkStack,
    GtkStackPage,
    GtkTextView,
    GtkToggleButton,
    GtkViewport,
} from "@gtkx/react-gi/gtk";
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Demo, DemoProviderProps } from "../types.js";
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

const INITIAL_PREVIEW_TEXT = [
    "Grumpy wizards make toxic brew for the evil Queen and Jack. A quick movement of the enemy will jeopardize six gunboats. The job of waxing linoleum frequently peeves chintzy kids. My girl wove six dozen plaid jackets before she quit. Twelve ziggurats quickly jumped a finch box.",
    "Разъяренный чтец эгоистично бьёт пятью жердями шустрого фехтовальщика. Наш банк вчера же выплатил Ф.Я. Эйхгольду комиссию за ценные вещи. Эх, чужак, общий съём цен шляп (юфть) – вдрызг! В чащах юга жил бы цитрус? Да, но фальшивый экземпляр!",
    "Τάχιστη αλώπηξ βαφής ψημένη γη, δρασκελίζει υπέρ νωθρού κυνός",
].join("\n\n");

const PARAGRAPH_SAMPLES = [
    "Grumpy wizards make toxic brew for the evil Queen and Jack. A quick movement of the enemy will jeopardize six gunboats. The job of waxing linoleum frequently peeves chintzy kids. My girl wove six dozen plaid jackets before she quit. Twelve ziggurats quickly jumped a finch box.",
    "\u0420\u0430\u0437\u044a\u044f\u0440\u0435\u043d\u043d\u044b\u0439 \u0447\u0442\u0435\u0446 \u044d\u0433\u043e\u0438\u0441\u0442\u0438\u0447\u043d\u043e \u0431\u044c\u0451\u0442 \u043f\u044f\u0442\u044c\u044e \u0436\u0435\u0440\u0434\u044f\u043c\u0438 \u0448\u0443\u0441\u0442\u0440\u043e\u0433\u043e \u0444\u0435\u0445\u0442\u043e\u0432\u0430\u043b\u044c\u0449\u0438\u043a\u0430. \u041d\u0430\u0448 \u0431\u0430\u043d\u043a \u0432\u0447\u0435\u0440\u0430 \u0436\u0435 \u0432\u044b\u043f\u043b\u0430\u0442\u0438\u043b \u0424.\u042f. \u042d\u0439\u0445\u0433\u043e\u043b\u044c\u0434\u0443 \u043a\u043e\u043c\u0438\u0441\u0441\u0438\u044e \u0437\u0430 \u0446\u0435\u043d\u043d\u044b\u0435 \u0432\u0435\u0449\u0438. \u042d\u0445, \u0447\u0443\u0436\u0430\u043a, \u043e\u0431\u0449\u0438\u0439 \u0441\u044a\u0451\u043c \u0446\u0435\u043d \u0448\u043b\u044f\u043f (\u044e\u0444\u0442\u044c) \u2013 \u0432\u0434\u0440\u044b\u0437\u0433! \u0412 \u0447\u0430\u0449\u0430\u0445 \u044e\u0433\u0430 \u0436\u0438\u043b \u0431\u044b \u0446\u0438\u0442\u0440\u0443\u0441? \u0414\u0430, \u043d\u043e \u0444\u0430\u043b\u044c\u0448\u0438\u0432\u044b\u0439 \u044d\u043a\u0437\u0435\u043c\u043f\u043b\u044f\u0440!",
    "\u03a4\u03ac\u03c7\u03b9\u03c3\u03c4\u03b7 \u03b1\u03bb\u03ce\u03c0\u03b7\u03be \u03b2\u03b1\u03c6\u03ae\u03c2 \u03c8\u03b7\u03bc\u03ad\u03bd\u03b7 \u03b3\u03b7, \u03b4\u03c1\u03b1\u03c3\u03ba\u03b5\u03bb\u03af\u03b6\u03b5\u03b9 \u03c5\u03c0\u03ad\u03c1 \u03bd\u03c9\u03b8\u03c1\u03bf\u03cd \u03ba\u03c5\u03bd\u03cc\u03c2",
];

type ViewMode = "plain" | "waterfall" | "edit";

const buildRgba = (red: number, green: number, blue: number, alpha: number): Gdk.RGBA => {
    const rgba = new Gdk.RGBA();
    rgba.red = red;
    rgba.green = green;
    rgba.blue = blue;
    rgba.alpha = alpha;
    return rgba;
};

const createDefaultFgColor = () => buildRgba(0, 0, 0, 1);
const createDefaultBgColor = () => buildRgba(1, 1, 1, 1);
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

type FontFeaturesState = ReturnType<typeof useFontFeaturesState>;
type FontFeaturesStyles = ReturnType<typeof useFontFeaturesStyles>;
type FontFeaturesHandlers = ReturnType<typeof useFontFeaturesHandlers>;

function useFontFeaturesState() {
    const [fontDesc, setFontDesc] = useState<Pango.FontDescription | null>(createDefaultFontDesc);
    const [checkStates, setCheckStates] = useState<Map<string, FeatureState>>(createInitialCheckStates);
    const [radioStates, setRadioStates] = useState<Map<string, string>>(createInitialRadioStates);
    const [fgColor, setFgColor] = useState<Gdk.RGBA>(createDefaultFgColor);
    const [bgColor, setBgColor] = useState<Gdk.RGBA>(createDefaultBgColor);
    const [size, setSize] = useState(14);
    const [letterSpacing, setLetterSpacing] = useState(0);
    const [lineHeight, setLineHeight] = useState(1);
    const [viewMode, setViewMode] = useState<ViewMode>("plain");
    const [previewText, setPreviewText] = useState(INITIAL_PREVIEW_TEXT);
    const [previewSelection, setPreviewSelection] = useState<{ start: number; end: number } | null>(null);
    const sampleCounterRef = useRef(0);
    const savedTextRef = useRef("");
    const previewLabelRef = useRef<Gtk.Label | null>(null);
    const editTextViewRef = useRef<Gtk.TextView | null>(null);
    const editScrolledWindowRef = useRef<Gtk.ScrolledWindow | null>(null);
    const containerRef = useRef<Gtk.Box | null>(null);

    return {
        fontDesc,
        setFontDesc,
        checkStates,
        setCheckStates,
        radioStates,
        setRadioStates,
        fgColor,
        setFgColor,
        bgColor,
        setBgColor,
        size,
        setSize,
        letterSpacing,
        setLetterSpacing,
        lineHeight,
        setLineHeight,
        viewMode,
        setViewMode,
        previewText,
        setPreviewText,
        previewSelection,
        setPreviewSelection,
        sampleCounterRef,
        savedTextRef,
        previewLabelRef,
        editTextViewRef,
        editScrolledWindowRef,
        containerRef,
    };
}

const buildFontFeaturesString = (checkStates: Map<string, FeatureState>, radioStates: Map<string, string>) => {
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

interface PreviewStyleArgs {
    fontDesc: Pango.FontDescription | null;
    size: number;
    fgColor: Gdk.RGBA;
    letterSpacing: number;
    lineHeight: number;
}

const buildPreviewStyle = ({ fontDesc, size, fgColor, letterSpacing, lineHeight }: PreviewStyleArgs) => {
    const fontFamily = fontDesc?.getFamily() ?? "Sans";
    const { r, g, b } = rgbColor(fgColor);
    return css`
        label& {
            font-family: "${fontFamily}";
            font-size: ${size}pt;
            color: rgb(${r}, ${g}, ${b});
            letter-spacing: ${letterSpacing / 1024}em;
            line-height: ${lineHeight};
            padding: 16px;
        }
    `;
};

interface EditStyleArgs {
    fontDesc: Pango.FontDescription | null;
    size: number;
    fontFeaturesString: string;
    fgColor: Gdk.RGBA;
    letterSpacing: number;
}

const buildEditStyle = ({ fontDesc, size, fontFeaturesString, fgColor, letterSpacing }: EditStyleArgs) => {
    const fontFamily = fontDesc?.getFamily() ?? "Sans";
    const { r, g, b } = rgbColor(fgColor);
    return css`
        textview& {
            font-family: "${fontFamily}";
            font-size: ${size}pt;
            font-feature-settings: ${fontFeaturesString};
            color: rgb(${r}, ${g}, ${b});
            letter-spacing: ${letterSpacing / 1024}em;
        }
    `;
};

interface WaterfallStyleArgs {
    fontDesc: Pango.FontDescription | null;
    wfSize: number;
    fontFeaturesString: string;
    fgColor: Gdk.RGBA;
    letterSpacing: number;
}

const buildWaterfallStyle = ({ fontDesc, wfSize, fontFeaturesString, fgColor, letterSpacing }: WaterfallStyleArgs) => {
    const fontFamily = fontDesc?.getFamily() ?? "Sans";
    const { r, g, b } = rgbColor(fgColor);
    return css`
        label& {
            font-family: "${fontFamily}";
            font-size: ${wfSize}pt;
            font-feature-settings: ${fontFeaturesString};
            color: rgb(${r}, ${g}, ${b});
            letter-spacing: ${letterSpacing / 1024}em;
        }
    `;
};

function useFontFeaturesStyles(state: ReturnType<typeof useFontFeaturesState>) {
    const { fontDesc, fgColor, bgColor, size, letterSpacing, lineHeight, checkStates, radioStates } = state;

    const fontFeaturesString = buildFontFeaturesString(checkStates, radioStates);

    const bgStyle = buildBgStyle(bgColor);

    const previewStyle = buildPreviewStyle({ fontDesc, size, fgColor, letterSpacing, lineHeight });

    const editStyle = buildEditStyle({ fontDesc, size, fontFeaturesString, fgColor, letterSpacing });

    const createWaterfallStyle = (wfSize: number) =>
        buildWaterfallStyle({ fontDesc, wfSize, fontFeaturesString, fgColor, letterSpacing });

    const pangoFontFeaturesString = (() => {
        if (fontFeaturesString === "normal") return null;
        return fontFeaturesString.replaceAll('"', "").replaceAll(" 1", "=1").replaceAll(" 0", "=0");
    })();

    const settingsText = pangoFontFeaturesString ?? "";

    const descriptionText = fontDesc?.toString() ?? "Sans 14";

    return {
        fontFeaturesString,
        bgStyle,
        previewStyle,
        editStyle,
        createWaterfallStyle,
        settingsText,
        pangoFontFeaturesString,
        descriptionText,
    };
}

function useFeatureHandlers(state: ReturnType<typeof useFontFeaturesState>) {
    const { setCheckStates, setRadioStates } = state;

    const toggleCheck = (tag: string) => {
        setCheckStates((prev) => {
            const next = new Map(prev);
            const current = next.get(tag) ?? "inconsistent";
            if (current === "inconsistent") next.set(tag, "active");
            else if (current === "active") next.set(tag, "inactive");
            else next.set(tag, "active");
            return next;
        });
    };

    const resetToInconsistent = (tag: string) => {
        setCheckStates((prev) => {
            const next = new Map(prev);
            next.set(tag, "inconsistent");
            return next;
        });
    };

    const selectRadio = (groupTitle: string, tag: string) => {
        setRadioStates((prev) => {
            const next = new Map(prev);
            next.set(groupTitle, tag);
            return next;
        });
    };

    const resetFeatures = () => {
        setCheckStates(createInitialCheckStates());
        setRadioStates(createInitialRadioStates());
    };

    return { toggleCheck, resetToInconsistent, selectRadio, resetFeatures };
}

function useColorHandlers(state: ReturnType<typeof useFontFeaturesState>) {
    const { fgColor, bgColor, setFgColor, setBgColor, setSize, setLetterSpacing, setLineHeight } = state;

    const swapColors = () => {
        setFgColor(buildRgba(bgColor.red, bgColor.green, bgColor.blue, 1));
        setBgColor(buildRgba(fgColor.red, fgColor.green, fgColor.blue, 1));
    };

    const resetBasic = () => {
        setSize(20);
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
        if (tv) tv.getBuffer().setText(text, -1);
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

function useEntryHandlers(state: ReturnType<typeof useFontFeaturesState>) {
    const { setSize, setLetterSpacing, setLineHeight } = state;

    const handleSizeEntry = (entry: Gtk.Entry) => {
        const val = Number.parseFloat(entry.getText());
        if (Number.isFinite(val) && val >= 7 && val <= 100) {
            setSize(val);
        }
    };

    const handleLetterspacingEntry = (entry: Gtk.Entry) => {
        const val = Number.parseFloat(entry.getText());
        if (Number.isFinite(val) && val >= -1024 && val <= 8192) {
            setLetterSpacing(val);
        }
    };

    const handleLineHeightEntry = (entry: Gtk.Entry) => {
        const val = Number.parseFloat(entry.getText());
        if (Number.isFinite(val) && val >= 0.75 && val <= 2.5) {
            setLineHeight(val);
        }
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

function usePreviewSelectionTracking(
    previewLabelRef: React.RefObject<Gtk.Label | null>,
    setPreviewSelection: (selection: { start: number; end: number } | null) => void,
) {
    useEffect(() => {
        const label = previewLabelRef.current;
        if (!label) return;

        const sync = () => {
            const [hasSelection, selStart, selEnd] = label.getSelectionBounds();
            setPreviewSelection(hasSelection ? { start: selStart, end: selEnd } : null);
        };

        sync();
        label.on("notify::cursor-position", sync);
        label.on("notify::selection-bound", sync);

        return () => {
            label.off("notify::cursor-position", sync);
            label.off("notify::selection-bound", sync);
        };
    }, [previewLabelRef, setPreviewSelection]);
}

function usePreviewAttributes(
    pangoFontFeaturesString: string | null,
    previewSelection: { start: number; end: number } | null,
): Pango.AttrList | null {
    return (() => {
        if (!pangoFontFeaturesString) return null;
        const attrList = Pango.AttrList.new();
        const attr = Pango.attrFontFeaturesNew(pangoFontFeaturesString);
        attr.startIndex = previewSelection?.start ?? 0;
        attr.endIndex = previewSelection?.end ?? 0xffffffff;
        attrList.insert(attr);
        return attrList;
    })();
}

const FontFeaturesFontButton = ({ state }: { state: FontFeaturesState }) => {
    const { fontDesc, setFontDesc, setSize } = state;
    return (
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
    );
};

const FontFeaturesGrid = ({ state, handlers }: { state: FontFeaturesState; handlers: FontFeaturesHandlers }) => {
    const { size, letterSpacing, lineHeight, viewMode } = state;
    const { setSize, setLetterSpacing, setLineHeight } = state;
    return (
        <GtkGrid columnSpacing={10} rowSpacing={10}>
            <SliderEntryRow
                row={0}
                label="Size"
                entryName="size_entry"
                value={size}
                lower={7}
                upper={100}
                stepIncrement={0.5}
                pageIncrement={10}
                onValueChanged={setSize}
                displayText={String(Math.round(size * 10) / 10)}
                onEntryActivate={handlers.handleSizeEntry}
                sensitive={viewMode !== "waterfall"}
            />
            <SliderEntryRow
                row={1}
                label="Letterspacing"
                entryName="letterspacing_entry"
                value={letterSpacing}
                lower={-1024}
                upper={8192}
                stepIncrement={1}
                pageIncrement={512}
                onValueChanged={setLetterSpacing}
                displayText={String(Math.round(letterSpacing))}
                onEntryActivate={handlers.handleLetterspacingEntry}
            />
            <SliderEntryRow
                row={2}
                label="Line Height"
                entryName="line_height_entry"
                value={lineHeight}
                lower={0.75}
                upper={2.5}
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

const FontFeaturesColorRows = ({ state, handlers }: { state: FontFeaturesState; handlers: FontFeaturesHandlers }) => {
    const { fgColor, setFgColor, bgColor, setBgColor } = state;
    return (
        <>
            <GtkGridChild column={0} row={3}>
                <GtkLabel label="Foreground" xalign={0} valign={Gtk.Align.BASELINE} />
            </GtkGridChild>
            <GtkGridChild column={1} row={3}>
                <GtkColorDialogButton rgba={fgColor} onRgbaChanged={setFgColor} valign={Gtk.Align.BASELINE} />
            </GtkGridChild>

            <GtkGridChild column={0} row={4}>
                <GtkLabel label="Background" xalign={0} valign={Gtk.Align.BASELINE} />
            </GtkGridChild>
            <GtkGridChild column={1} row={4}>
                <GtkColorDialogButton rgba={bgColor} onRgbaChanged={setBgColor} valign={Gtk.Align.BASELINE} />
            </GtkGridChild>

            <GtkGridChild column={2} row={3} rowSpan={2}>
                <GtkButton
                    name="swap-colors"
                    iconName="object-flip-vertical-symbolic"
                    halign={Gtk.Align.START}
                    valign={Gtk.Align.CENTER}
                    cssClasses={["circular"]}
                    tooltipText="Swap colors"
                    onClicked={handlers.swapColors}
                />
            </GtkGridChild>
        </>
    );
};

interface SliderEntryRowProps {
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
    sensitive?: boolean;
}

const SliderEntryRow = ({
    row,
    label,
    entryName,
    value,
    lower,
    upper,
    stepIncrement,
    pageIncrement,
    onValueChanged,
    displayText,
    onEntryActivate,
    sensitive,
}: SliderEntryRowProps) => {
    const adjustment = useAdjustment({ value, lower, upper, stepIncrement, pageIncrement });
    return (
        <>
            <GtkGridChild column={0} row={row}>
                <GtkLabel label={label} xalign={0} valign={Gtk.Align.BASELINE} />
            </GtkGridChild>
            <GtkGridChild column={1} row={row}>
                <GtkScale
                    hexpand
                    widthRequest={100}
                    valign={Gtk.Align.BASELINE}
                    adjustment={adjustment}
                    onValueChanged={(scale) => onValueChanged(scale.getValue())}
                    sensitive={sensitive}
                />
            </GtkGridChild>
            <GtkGridChild column={2} row={row}>
                <GtkEntry
                    name={entryName}
                    widthChars={4}
                    maxWidthChars={4}
                    valign={Gtk.Align.BASELINE}
                    text={displayText}
                    onActivate={onEntryActivate}
                    sensitive={sensitive}
                />
            </GtkGridChild>
        </>
    );
};

const FontFeaturesExpander = ({ state, handlers }: { state: FontFeaturesState; handlers: FontFeaturesHandlers }) => {
    const { checkStates, radioStates } = state;
    return (
        <GtkExpander
            name="features-expander"
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

const FontFeaturesSidebar = ({ state, handlers }: { state: FontFeaturesState; handlers: FontFeaturesHandlers }) => (
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

interface FeatureGroupBoxProps {
    group: FeatureGroup;
    checkStates: Map<string, FeatureState>;
    radioStates: Map<string, string>;
    onToggleCheck: (tag: string) => void;
    onResetToInconsistent: (tag: string) => void;
    onSelectRadio: (groupTitle: string, tag: string) => void;
}

const FeatureGroupBox = ({
    group,
    checkStates,
    radioStates,
    onToggleCheck,
    onResetToInconsistent,
    onSelectRadio,
}: FeatureGroupBoxProps) => (
    <GtkBox orientation={Gtk.Orientation.VERTICAL} halign={Gtk.Align.START}>
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
                      onToggled={() => onSelectRadio(group.title, tag)}
                  />
              ))
            : group.tags.map((tag) => (
                  <GtkCheckButton
                      key={tag}
                      label={getFeatureDisplayName(tag)}
                      active={checkStates.get(tag) === "active"}
                      inconsistent={checkStates.get(tag) === "inconsistent"}
                      onToggled={() => onToggleCheck(tag)}
                  >
                      <GtkGestureClick button={3} onPressed={() => onResetToInconsistent(tag)} />
                  </GtkCheckButton>
              ))}
    </GtkBox>
);

interface FontFeaturesPreviewProps {
    state: FontFeaturesState;
    styles: FontFeaturesStyles;
    handlers: FontFeaturesHandlers;
    stackPage: string;
    previewAttributes: Pango.AttrList | null;
}

interface FontFeaturesPreviewLabelProps {
    state: FontFeaturesState;
    styles: FontFeaturesStyles;
    attributes: Pango.AttrList | null;
}

const FontFeaturesPreviewLabel = ({ state, styles, attributes }: FontFeaturesPreviewLabelProps) => {
    const { previewText, previewLabelRef, viewMode } = state;
    const { previewStyle, createWaterfallStyle } = styles;

    if (viewMode === "waterfall") {
        return (
            <GtkBox name="waterfall-box" orientation={Gtk.Orientation.VERTICAL} spacing={4}>
                {WATERFALL_SIZES.map((wfSize) => (
                    <GtkLabel
                        key={wfSize}
                        name="waterfall-label"
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
        );
    }

    return (
        <GtkLabel
            name="preview-label"
            ref={previewLabelRef}
            label={previewText}
            attributes={attributes}
            cssClasses={[previewStyle]}
            wrap
            xalign={0}
            yalign={0}
            valign={Gtk.Align.START}
            selectable
        />
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
            label={styles.settingsText}
            wrap
            xalign={0}
            valign={Gtk.Align.END}
            widthChars={50}
            maxWidthChars={50}
            hexpand
            cssClasses={["monospace"]}
        />
        <GtkButton label="Alphabet" onClicked={handlers.handleAlphabet} />
        <GtkButton label="Paragraph" onClicked={handlers.handleParagraph} />
    </GtkBox>
);

function useViewModeToggleHandlers(state: FontFeaturesState) {
    const { previewText, setViewMode, savedTextRef } = state;

    const handlePlainToggled = (btn: Gtk.ToggleButton) => {
        if (btn.getActive()) setViewMode("plain");
    };

    const handleWaterfallToggled = (btn: Gtk.ToggleButton) => {
        if (btn.getActive()) setViewMode("waterfall");
    };

    const handleEditToggled = (btn: Gtk.ToggleButton) => {
        if (btn.getActive()) {
            savedTextRef.current = previewText;
            setViewMode("edit");
        }
    };

    return { handlePlainToggled, handleWaterfallToggled, handleEditToggled };
}

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
            <GtkLabel
                label={styles.descriptionText}
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
                    ref={setPlainToggle}
                    name="plain_toggle"
                    label="Plain"
                    active={viewMode === "plain"}
                    valign={Gtk.Align.BASELINE}
                    onToggled={handlePlainToggled}
                />
                <GtkToggleButton
                    name="waterfall_toggle"
                    label="Waterfall"
                    group={plainToggle}
                    active={viewMode === "waterfall"}
                    valign={Gtk.Align.BASELINE}
                    onToggled={handleWaterfallToggled}
                />
            </GtkBox>
            <GtkToggleButton
                name="edit_toggle"
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

const FontFeaturesPreview = ({ state, styles, handlers, stackPage, previewAttributes }: FontFeaturesPreviewProps) => (
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
        <GtkScrolledWindow
            ref={state.editScrolledWindowRef}
            vexpand
            propagateNaturalHeight
            cssClasses={[styles.bgStyle]}
        >
            <GtkStack name="stack" page={stackPage}>
                <GtkStackPage id="label">
                    <FontFeaturesPreviewLabel state={state} styles={styles} attributes={previewAttributes} />
                </GtkStackPage>
                <GtkStackPage id="entry">
                    <GtkTextView
                        ref={state.editTextViewRef}
                        cssClasses={[styles.editStyle]}
                        wrapMode={Gtk.WrapMode.WORD}
                        valign={Gtk.Align.FILL}
                    />
                </GtkStackPage>
            </GtkStack>
        </GtkScrolledWindow>

        <FontFeaturesPreviewSettingsRow styles={styles} handlers={handlers} />
        <FontFeaturesPreviewControlsRow state={state} styles={styles} />
    </GtkBox>
);

interface FontFeaturesContextValue {
    state: FontFeaturesState;
    styles: FontFeaturesStyles;
    handlers: FontFeaturesHandlers;
}

const FontFeaturesContext = createContext<FontFeaturesContextValue | null>(null);

const useFontFeatures = (): FontFeaturesContextValue => {
    const ctx = useContext(FontFeaturesContext);
    if (!ctx) throw new Error("useFontFeatures must be used inside a FontFeaturesProvider");
    return ctx;
};

const FontFeaturesProvider = ({ children }: DemoProviderProps) => {
    const state = useFontFeaturesState();
    const styles = useFontFeaturesStyles(state);
    const handlers = useFontFeaturesHandlers(state);
    const value = {
        state,
        styles,
        handlers,
    };
    return <FontFeaturesContext.Provider value={value}>{children}</FontFeaturesContext.Provider>;
};

const FontFeaturesTitlebar = () => {
    const { handlers } = useFontFeatures();
    return (
        <GtkHeaderBar
            name="font-features-header"
            packStart={
                <GtkButton
                    name="reset"
                    iconName="view-refresh-symbolic"
                    tooltipText="Reset"
                    onClicked={handlers.resetAll}
                />
            }
        />
    );
};

const FontFeaturesDemo = () => {
    const { state, styles, handlers } = useFontFeatures();

    usePreviewSelectionTracking(state.previewLabelRef, state.setPreviewSelection);
    const previewAttributes = usePreviewAttributes(styles.pangoFontFeaturesString, state.previewSelection);

    const stackPage = state.viewMode === "edit" ? "entry" : "label";

    useLayoutEffect(() => {
        if (state.viewMode !== "edit") return;
        const tv = state.editTextViewRef.current;
        if (!tv) return;
        state.editScrolledWindowRef.current?.getVadjustment()?.setValue(0);
        tv.grabFocus();
    }, [state.viewMode, state.editTextViewRef, state.editScrolledWindowRef]);

    return (
        <>
            <GtkShortcutController scope={Gtk.ShortcutScope.MANAGED}>
                <GtkShortcut
                    trigger={Gtk.ShortcutTrigger.parseString("Escape")}
                    action={Gtk.CallbackAction.new(() => {
                        if (state.viewMode !== "edit") return false;
                        const tv = state.editTextViewRef.current;
                        if (tv) {
                            const buffer = tv.getBuffer();
                            buffer.setText(state.savedTextRef.current, -1);
                        }
                        state.setPreviewText(state.savedTextRef.current);
                        state.setViewMode("plain");
                        return true;
                    })}
                />
            </GtkShortcutController>
            <GtkBox ref={state.containerRef}>
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
        </>
    );
};

export const fontFeaturesDemo: Demo = {
    id: "font-features",
    title: "Pango/Font Explorer",
    description:
        "This example demonstrates support for OpenType font features with Pango attributes. The attributes can be used manually or via Pango markup.\n\nIt can also be used to explore available features in OpenType fonts and their effect.\n\nIf the selected font supports OpenType font variations, then the axes are also offered for customization.",
    keywords: [],
    component: FontFeaturesDemo,
    titlebar: FontFeaturesTitlebar,
    provider: FontFeaturesProvider,
    sourceCode,
    defaultWidth: 600,
    defaultHeight: 500,
};
