import { css } from "@gtkx/css";
import { createRef } from "@gtkx/ffi";
import * as Gdk from "@gtkx/ffi/gdk";
import * as GObject from "@gtkx/ffi/gobject";
import * as Gtk from "@gtkx/ffi/gtk";
import * as HarfBuzz from "@gtkx/ffi/harfbuzz";
import * as Pango from "@gtkx/ffi/pango";
import * as PangoCairo from "@gtkx/ffi/pangocairo";
import {
    GtkBox,
    GtkButton,
    GtkCheckButton,
    GtkColorDialogButton,
    GtkDropDown,
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
    x,
} from "@gtkx/react";
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

const HB_OT_NAME_ID_INVALID = 65535;

const getFeatureDisplayName = (tag: string, fontFeatureNames?: Map<string, string>): string => {
    if (tag === "xxxx") return "Default";
    const fontName = fontFeatureNames?.get(tag);
    if (fontName) return fontName;
    const ssMatch = tag.match(/^ss(\d{2})$/);
    if (ssMatch) return `Stylistic Set ${Number.parseInt(ssMatch[1] ?? "0", 10)}`;
    const cvMatch = tag.match(/^cv(\d{2})$/);
    if (cvMatch) return `Character Variant ${Number.parseInt(cvMatch[1] ?? "0", 10)}`;
    return FEATURE_DISPLAY_NAMES[tag] ?? tag;
};

const resolveFeatureNames = (
    face: HarfBuzz.FaceT,
    scriptIndex: number,
    langIndex: number,
    supportedFeatures: Set<string>,
): Map<string, string> => {
    const names = new Map<string, string>();

    for (const tagStr of supportedFeatures) {
        if (!tagStr.match(/^(ss|cv)\d{2}$/)) continue;

        const tag = stringToTag(tagStr);

        for (const tableTag of [TAG_GSUB, TAG_GPOS]) {
            const featureIndexRef = createRef<number>(0);
            const found = HarfBuzz.otLayoutLanguageFindFeature(
                face,
                tableTag,
                scriptIndex,
                langIndex,
                tag,
                featureIndexRef,
            );
            if (!found) continue;

            const labelIdRef = createRef<number>(0);
            const tooltipIdRef = createRef<number>(0);
            const sampleIdRef = createRef<number>(0);
            const numParamsRef = createRef<number>(0);
            const firstParamIdRef = createRef<number>(0);

            const hasNames = HarfBuzz.otLayoutFeatureGetNameIds(
                face,
                tableTag,
                featureIndexRef.value,
                labelIdRef,
                tooltipIdRef,
                sampleIdRef,
                numParamsRef,
                firstParamIdRef,
            );

            if (hasNames && labelIdRef.value !== HB_OT_NAME_ID_INVALID) {
                const textRef = createRef<string[]>([""]);
                const textSizeRef = createRef<number>(64);
                HarfBuzz.otNameGetUtf8(face, labelIdRef.value, HarfBuzz.languageGetDefault(), textRef, textSizeRef);
                const name = textRef.value[0];
                if (name) {
                    names.set(tagStr, name);
                    break;
                }
            }
        }
    }

    return names;
};

interface AxisInfo {
    tag: string;
    name: string;
    minValue: number;
    defaultValue: number;
    maxValue: number;
}

interface NamedInstance {
    name: string;
    index: number;
    coords: Map<string, number>;
}

interface ScriptLangItem {
    label: string;
    scriptIndex: number;
    langIndex: number;
    langTag: number;
}

const WATERFALL_SIZES = [7, 8, 9, 10, 12, 14, 16, 20, 24, 30, 40, 50, 60, 70, 90];

const ALPHABET_SAMPLES = ["abcdefghijklmnopqrstuvwxzy", "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "0123456789", "!@#$%^&*/?;"];

const PARAGRAPH_SAMPLES = [
    "Grumpy wizards make toxic brew for the evil Queen and Jack. A quick movement of the enemy will jeopardize six gunboats. The job of waxing linoleum frequently peeves chintzy kids. My girl wove six dozen plaid jackets before she quit. Twelve ziggurats quickly jumped a finch box.",
    "\u0420\u0430\u0437\u044a\u044f\u0440\u0435\u043d\u043d\u044b\u0439 \u0447\u0442\u0435\u0446 \u044d\u0433\u043e\u0438\u0441\u0442\u0438\u0447\u043d\u043e \u0431\u044c\u0451\u0442 \u043f\u044f\u0442\u044c\u044e \u0436\u0435\u0440\u0434\u044f\u043c\u0438 \u0448\u0443\u0441\u0442\u0440\u043e\u0433\u043e \u0444\u0435\u0445\u0442\u043e\u0432\u0430\u043b\u044c\u0449\u0438\u043a\u0430. \u041d\u0430\u0448 \u0431\u0430\u043d\u043a \u0432\u0447\u0435\u0440\u0430 \u0436\u0435 \u0432\u044b\u043f\u043b\u0430\u0442\u0438\u043b \u0424.\u042f. \u042d\u0439\u0445\u0433\u043e\u043b\u044c\u0434\u0443 \u043a\u043e\u043c\u0438\u0441\u0441\u0438\u044e \u0437\u0430 \u0446\u0435\u043d\u043d\u044b\u0435 \u0432\u0435\u0449\u0438. \u042d\u0445, \u0447\u0443\u0436\u0430\u043a, \u043e\u0431\u0449\u0438\u0439 \u0441\u044a\u0451\u043c \u0446\u0435\u043d \u0448\u043b\u044f\u043f (\u044e\u0444\u0442\u044c) \u2013 \u0432\u0434\u0440\u044b\u0437\u0433! \u0412 \u0447\u0430\u0449\u0430\u0445 \u044e\u0433\u0430 \u0436\u0438\u043b \u0431\u044b \u0446\u0438\u0442\u0440\u0443\u0441? \u0414\u0430, \u043d\u043e \u0444\u0430\u043b\u044c\u0448\u0438\u0432\u044b\u0439 \u044d\u043a\u0437\u0435\u043c\u043f\u043b\u044f\u0440!",
    "\u03a4\u03ac\u03c7\u03b9\u03c3\u03c4\u03b7 \u03b1\u03bb\u03ce\u03c0\u03b7\u03be \u03b2\u03b1\u03c6\u03ae\u03c2 \u03c8\u03b7\u03bc\u03ad\u03bd\u03b7 \u03b3\u03b7, \u03b4\u03c1\u03b1\u03c3\u03ba\u03b5\u03bb\u03af\u03b6\u03b5\u03b9 \u03c5\u03c0\u03ad\u03c1 \u03bd\u03c9\u03b8\u03c1\u03bf\u03cd \u03ba\u03c5\u03bd\u03cc\u03c2",
];

const AXIS_NAMES: Record<string, string> = {
    wght: "Weight",
    wdth: "Width",
    slnt: "Slant",
    ital: "Italic",
    opsz: "Optical Size",
    GRAD: "Grade",
    XTRA: "X Transparent",
    YTRA: "Y Transparent",
    XOPQ: "X Opaque",
    YOPQ: "Y Opaque",
    YTLC: "Y Transparent LC",
    YTUC: "Y Transparent UC",
    YTAS: "Y Transparent AS",
    YTDE: "Y Transparent DE",
    YTFI: "Y Transparent FI",
};

const TAG_GSUB = ((71 << 24) | (83 << 16) | (85 << 8) | 66) >>> 0;
const TAG_GPOS = ((71 << 24) | (80 << 16) | (79 << 8) | 83) >>> 0;
const TAG_DEFAULT_LANGUAGE = ((100 << 24) | (102 << 16) | (108 << 8) | 116) >>> 0;

const tagToString = (tag: number): string => {
    return String.fromCharCode((tag >> 24) & 0xff, (tag >> 16) & 0xff, (tag >> 8) & 0xff, tag & 0xff);
};

const stringToTag = (s: string): number => {
    return ((s.charCodeAt(0) << 24) | (s.charCodeAt(1) << 16) | (s.charCodeAt(2) << 8) | s.charCodeAt(3)) >>> 0;
};

const LANGUAGE_TAG_NAMES: Record<number, string> = (() => {
    const names: Record<string, string> = {
        AFK: "Afrikaans",
        ARA: "Arabic",
        ASM: "Assamese",
        AZE: "Azerbaijani",
        BEL: "Belarusian",
        BEN: "Bengali",
        BGR: "Bulgarian",
        CAT: "Catalan",
        CES: "Czech",
        CHI: "Chinese",
        DAN: "Danish",
        DEU: "German",
        ELL: "Greek",
        ENG: "English",
        ESP: "Spanish",
        EST: "Estonian",
        EUQ: "Basque",
        FIN: "Finnish",
        FRA: "French",
        GAE: "Scottish Gaelic",
        GUJ: "Gujarati",
        HAU: "Hausa",
        HIN: "Hindi",
        HRV: "Croatian",
        HUN: "Hungarian",
        HYE: "Armenian",
        IND: "Indonesian",
        ITA: "Italian",
        JPN: "Japanese",
        KAN: "Kannada",
        KAT: "Georgian",
        KAZ: "Kazakh",
        KHM: "Khmer",
        KOR: "Korean",
        KUR: "Kurdish",
        LAO: "Lao",
        LAV: "Latvian",
        LIT: "Lithuanian",
        MAL: "Malayalam",
        MAR: "Marathi",
        MKD: "Macedonian",
        MLY: "Malay",
        MNG: "Mongolian",
        MOL: "Moldavian",
        NEP: "Nepali",
        NLD: "Dutch",
        NOR: "Norwegian",
        ORI: "Odia",
        PAN: "Punjabi",
        POL: "Polish",
        POR: "Portuguese",
        ROM: "Romanian",
        RUS: "Russian",
        SAN: "Sanskrit",
        SIN: "Sinhala",
        SKY: "Slovak",
        SLV: "Slovenian",
        SQI: "Albanian",
        SRB: "Serbian",
        SVE: "Swedish",
        TAM: "Tamil",
        TEL: "Telugu",
        THA: "Thai",
        TRK: "Turkish",
        UKR: "Ukrainian",
        URD: "Urdu",
        UZB: "Uzbek",
        VIT: "Vietnamese",
        ZHS: "Chinese Simplified",
        ZHT: "Chinese Traditional",
    };
    const result: Record<number, string> = {};
    for (const [tag, name] of Object.entries(names)) {
        const padded = tag.padEnd(4, " ");
        result[stringToTag(padded)] = name;
    }
    return result;
})();

const discoverScriptLangs = (face: HarfBuzz.FaceT): ScriptLangItem[] => {
    const seen = new Set<string>();
    const items: ScriptLangItem[] = [{ label: "None", scriptIndex: 0, langIndex: 0, langTag: 0 }];
    seen.add("0-0");

    for (const tableTag of [TAG_GSUB, TAG_GPOS]) {
        const scriptTagsRef = createRef<number[]>(new Array(80).fill(0));
        const scriptCountRef = createRef<number>(80);

        HarfBuzz.otLayoutTableGetScriptTags(face, tableTag, 0, scriptTagsRef, scriptCountRef);
        const scriptCount = scriptCountRef.value;

        for (let j = 0; j < scriptCount; j++) {
            const langTagsRef = createRef<number[]>(new Array(80).fill(0));
            const langCountRef = createRef<number>(80);

            HarfBuzz.otLayoutScriptGetLanguageTags(face, tableTag, j, 0, langTagsRef, langCountRef);
            const langCount = langCountRef.value;

            for (let k = 0; k < langCount; k++) {
                const langTag = langTagsRef.value[k] ?? 0;
                const key = `${j}-${langTag}`;
                if (seen.has(key)) continue;
                seen.add(key);

                let label: string;
                if (langTag === TAG_DEFAULT_LANGUAGE) {
                    label = "Default";
                } else {
                    label = LANGUAGE_TAG_NAMES[langTag] ?? tagToString(langTag).trim();
                }

                items.push({ label, scriptIndex: j, langIndex: k, langTag });
            }
        }
    }

    items.sort((a, b) => {
        if (a.langTag === 0) return -1;
        if (b.langTag === 0) return 1;
        return a.label.localeCompare(b.label);
    });

    return items;
};

const discoverSupportedFeatures = (face: HarfBuzz.FaceT, scriptIndex: number, langIndex: number): Set<string> => {
    const supported = new Set<string>();

    for (const tableTag of [TAG_GSUB, TAG_GPOS]) {
        const featureTagsRef = createRef<number[]>(new Array(80).fill(0));
        const featureCountRef = createRef<number>(80);

        HarfBuzz.otLayoutLanguageGetFeatureTags(
            face,
            tableTag,
            scriptIndex,
            langIndex,
            0,
            featureTagsRef,
            featureCountRef,
        );

        const count = featureCountRef.value;
        for (let i = 0; i < count; i++) {
            const tag = featureTagsRef.value[i] ?? 0;
            if (tag === 0) continue;
            supported.add(tagToString(tag));
        }
    }

    return supported;
};

const discoverVariableAxes = (face: HarfBuzz.FaceT): AxisInfo[] => {
    if (!HarfBuzz.otVarHasData(face)) return [];

    const axisCount = HarfBuzz.otVarGetAxisCount(face);
    if (axisCount === 0) return [];

    const axes: AxisInfo[] = [];
    for (let i = 0; i < axisCount; i++) {
        const info = new HarfBuzz.OtVarAxisInfoT();
        const axisCountRef = createRef<number>(1);
        const axisInfoRef = createRef<HarfBuzz.OtVarAxisInfoT[]>([info]);

        HarfBuzz.otVarGetAxisInfos(face, i, axisInfoRef, axisCountRef);

        if (axisCountRef.value > 0 && axisInfoRef.value[0]) {
            const axis = axisInfoRef.value[0];
            const tagStr = tagToString(axis.getTag());
            axes.push({
                tag: tagStr,
                name: AXIS_NAMES[tagStr] ?? tagStr,
                minValue: axis.getMinValue(),
                defaultValue: axis.getDefaultValue(),
                maxValue: axis.getMaxValue(),
            });
        }
    }

    return axes;
};

const discoverNamedInstances = (face: HarfBuzz.FaceT, axes: AxisInfo[]): NamedInstance[] => {
    const instanceCount = HarfBuzz.otVarGetNamedInstanceCount(face);
    if (instanceCount === 0) return [];

    const instances: NamedInstance[] = [];
    for (let i = 0; i < instanceCount; i++) {
        const nameId = HarfBuzz.otVarNamedInstanceGetSubfamilyNameId(face, i);
        const textRef = createRef<string[]>([""]);
        const textSizeRef = createRef<number>(64);
        HarfBuzz.otNameGetUtf8(face, nameId, HarfBuzz.languageGetDefault(), textRef, textSizeRef);
        const name = textRef.value[0];
        if (!name) continue;

        const coordCount = axes.length;
        const coordsRef = createRef<number[]>(new Array(coordCount).fill(0));
        const coordCountRef = createRef<number>(coordCount);
        HarfBuzz.otVarNamedInstanceGetDesignCoords(face, i, coordsRef, coordCountRef);

        const coords = new Map<string, number>();
        for (let j = 0; j < Math.min(coordCountRef.value, axes.length); j++) {
            const axis = axes[j];
            if (axis) {
                coords.set(axis.tag, coordsRef.value[j] ?? axis.defaultValue);
            }
        }

        instances.push({ name, index: i, coords });
    }

    return instances;
};

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
    const [supportedFeatures, setSupportedFeatures] = useState<Set<string> | null>(null);
    const [fontFeatureNames, setFontFeatureNames] = useState<Map<string, string>>(new Map());
    const [scriptLangItems, setScriptLangItems] = useState<ScriptLangItem[]>([]);
    const [selectedScriptLang, setSelectedScriptLang] = useState(0);
    const [variableAxes, setVariableAxes] = useState<AxisInfo[]>([]);
    const [axisValues, setAxisValues] = useState<Map<string, number>>(new Map());
    const [namedInstances, setNamedInstances] = useState<NamedInstance[]>([]);
    const [selectedInstance, setSelectedInstance] = useState(0);
    const [fgColor, setFgColor] = useState<Gdk.RGBA>(createDefaultFgColor);
    const [bgColor, setBgColor] = useState<Gdk.RGBA>(createDefaultBgColor);
    const [size, setSize] = useState(14);
    const [letterSpacing, setLetterSpacing] = useState(0);
    const [lineHeight, setLineHeight] = useState(1.0);
    const [viewMode, setViewMode] = useState<ViewMode>("plain");
    const [previewText, setPreviewText] = useState(PARAGRAPH_SAMPLES[0] ?? "");
    const [animatingAxes, setAnimatingAxes] = useState<Set<string>>(new Set());
    const sampleCounterRef = useRef(0);
    const savedTextRef = useRef("");
    const previewLabelRef = useRef<Gtk.Label | null>(null);
    const editTextViewRef = useRef<Gtk.TextView | null>(null);
    const containerRef = useRef<Gtk.Box | null>(null);
    const currentFaceRef = useRef<HarfBuzz.FaceT | null>(null);
    const animTickIds = useRef<Map<string, number>>(new Map());
    const animStartTimes = useRef<Map<string, number>>(new Map());
    const animIncreasing = useRef<Map<string, boolean>>(new Map());

    useLayoutEffect(() => {
        const win = window.current;
        if (win) {
            win.setDefaultSize(600, 500);
        }
    }, [window]);

    const updateFontInfo = useCallback(() => {
        if (!fontDesc || !containerRef.current) return;

        try {
            const fontMap = PangoCairo.fontMapGetDefault();
            const context = containerRef.current.getPangoContext();
            const font = fontMap.loadFont(context, fontDesc);
            if (!font) return;

            const hbFont = font.getHbFont();
            if (!hbFont) return;

            const face = HarfBuzz.fontGetFace(hbFont);
            currentFaceRef.current = face;

            const items = discoverScriptLangs(face);
            setScriptLangItems(items);
            setSelectedScriptLang(0);
            setSupportedFeatures(null);
            setFontFeatureNames(new Map());

            const axes = discoverVariableAxes(face);
            setVariableAxes(axes);
            const defaultValues = new Map<string, number>();
            for (const axis of axes) {
                defaultValues.set(axis.tag, axis.defaultValue);
            }
            setAxisValues(defaultValues);

            const instances = discoverNamedInstances(face, axes);
            setNamedInstances(instances);
            setSelectedInstance(0);

            setCheckStates(createInitialCheckStates());
            setRadioStates(createInitialRadioStates());
        } catch {
            currentFaceRef.current = null;
            setScriptLangItems([]);
            setSelectedScriptLang(0);
            setSupportedFeatures(null);
            setFontFeatureNames(new Map());
            setVariableAxes([]);
            setAxisValues(new Map());
            setNamedInstances([]);
            setSelectedInstance(0);
        }
    }, [fontDesc]);

    useLayoutEffect(() => {
        if (containerRef.current) {
            updateFontInfo();
        }
    }, [updateFontInfo]);

    const handleContainerRef = useCallback(
        (widget: Gtk.Box | null) => {
            containerRef.current = widget;
            if (widget && fontDesc) {
                updateFontInfo();
            }
        },
        [fontDesc, updateFontInfo],
    );

    const handleScriptLangChange = useCallback(
        (index: number) => {
            setSelectedScriptLang(index);
            const item = scriptLangItems[index];
            if (!item || item.langTag === 0) {
                setSupportedFeatures(null);
                setFontFeatureNames(new Map());
                setCheckStates(createInitialCheckStates());
                setRadioStates(createInitialRadioStates());
            } else if (currentFaceRef.current) {
                const supported = discoverSupportedFeatures(currentFaceRef.current, item.scriptIndex, item.langIndex);
                setSupportedFeatures(supported);
                setFontFeatureNames(
                    resolveFeatureNames(currentFaceRef.current, item.scriptIndex, item.langIndex, supported),
                );
                setCheckStates((prev) => {
                    const next = new Map(prev);
                    for (const [tag] of next) {
                        next.set(tag, "inconsistent");
                    }
                    return next;
                });
                setRadioStates(createInitialRadioStates());
            }
        },
        [scriptLangItems],
    );

    const isFeatureVisible = useCallback(
        (tag: string) => {
            if (tag === "xxxx") return true;
            return !supportedFeatures || supportedFeatures.has(tag);
        },
        [supportedFeatures],
    );

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

    const updateAxisValue = useCallback(
        (tag: string, value: number) => {
            setAxisValues((prev) => {
                const next = new Map(prev);
                next.set(tag, value);

                let matchedIndex = 0;
                for (let i = 0; i < namedInstances.length; i++) {
                    const inst = namedInstances[i];
                    if (!inst) continue;
                    let matches = true;
                    for (const axis of variableAxes) {
                        const instVal = inst.coords.get(axis.tag) ?? axis.defaultValue;
                        const curVal = axis.tag === tag ? value : (next.get(axis.tag) ?? axis.defaultValue);
                        if (Math.abs(instVal - curVal) > 0.01) {
                            matches = false;
                            break;
                        }
                    }
                    if (matches) {
                        matchedIndex = i + 1;
                        break;
                    }
                }
                setSelectedInstance(matchedIndex);

                return next;
            });
        },
        [namedInstances, variableAxes],
    );

    const handleInstanceChange = useCallback(
        (index: number) => {
            setSelectedInstance(index);
            if (index > 0) {
                const instance = namedInstances[index - 1];
                if (instance) {
                    setAxisValues(new Map(instance.coords));
                }
            }
        },
        [namedInstances],
    );

    const swapColors = useCallback(() => {
        const oldFg = fgColor;
        const oldBg = bgColor;
        setFgColor(new Gdk.RGBA({ red: oldBg.getRed(), green: oldBg.getGreen(), blue: oldBg.getBlue(), alpha: 1 }));
        setBgColor(new Gdk.RGBA({ red: oldFg.getRed(), green: oldFg.getGreen(), blue: oldFg.getBlue(), alpha: 1 }));
    }, [fgColor, bgColor]);

    const resetBasic = useCallback(() => {
        setSize(20);
        setLetterSpacing(0);
        setLineHeight(1.0);
        setFgColor(createDefaultFgColor());
        setBgColor(createDefaultBgColor());
    }, []);

    const resetFeatures = useCallback(() => {
        setCheckStates(createInitialCheckStates());
        setRadioStates(createInitialRadioStates());
    }, []);

    const stopAllAnimations = useCallback(() => {
        const widget = containerRef.current;
        if (widget) {
            for (const tickId of animTickIds.current.values()) {
                widget.removeTickCallback(tickId);
            }
        }
        animTickIds.current.clear();
        animStartTimes.current.clear();
        animIncreasing.current.clear();
        setAnimatingAxes(new Set());
    }, []);

    useEffect(() => stopAllAnimations, [stopAllAnimations]);

    const toggleAxisAnimation = useCallback(
        (axis: AxisInfo) => {
            const widget = containerRef.current;
            if (!widget) return;

            const existing = animTickIds.current.get(axis.tag);
            if (existing !== undefined) {
                widget.removeTickCallback(existing);
                animTickIds.current.delete(axis.tag);
                animStartTimes.current.delete(axis.tag);
                animIncreasing.current.delete(axis.tag);
                setAnimatingAxes((prev) => {
                    const next = new Set(prev);
                    next.delete(axis.tag);
                    return next;
                });
                return;
            }

            const lower = axis.minValue;
            const upper = axis.maxValue;
            const range = upper - lower;
            const currentValue = axisValues.get(axis.tag) ?? axis.defaultValue;
            const normalizedPosition = range > 0 ? (currentValue - lower) / range : 0;

            const now = performance.now();
            animStartTimes.current.set(axis.tag, now - normalizedPosition * 1000);
            animIncreasing.current.set(axis.tag, true);

            const easeOutCubic = (t: number) => {
                const p = t - 1;
                return p * p * p + 1;
            };

            const tickId = widget.addTickCallback(() => {
                const currentTime = performance.now();
                let startTime = animStartTimes.current.get(axis.tag) ?? currentTime;
                let increasing = animIncreasing.current.get(axis.tag) ?? true;

                if (currentTime >= startTime + 1000) {
                    startTime += 1000;
                    increasing = !increasing;
                    animStartTimes.current.set(axis.tag, startTime);
                    animIncreasing.current.set(axis.tag, increasing);
                }

                const t = Math.min(1, (currentTime - startTime) / 1000);
                const eased = easeOutCubic(t);

                const val = increasing ? lower + range * eased : upper - range * eased;
                updateAxisValue(axis.tag, val);
                return true;
            });

            animTickIds.current.set(axis.tag, tickId);
            setAnimatingAxes((prev) => {
                const next = new Set(prev);
                next.add(axis.tag);
                return next;
            });
        },
        [updateAxisValue, axisValues],
    );

    const resetVariations = useCallback(() => {
        stopAllAnimations();
        const defaultValues = new Map<string, number>();
        for (const axis of variableAxes) {
            defaultValues.set(axis.tag, axis.defaultValue);
        }
        setAxisValues(defaultValues);
        setSelectedInstance(0);
    }, [variableAxes, stopAllAnimations]);

    const resetAll = useCallback(() => {
        resetBasic();
        resetFeatures();
        resetVariations();
    }, [resetBasic, resetFeatures, resetVariations]);

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
                const selected = radioStates.get(group.title) ?? "xxxx";
                if (selected !== "xxxx" && isFeatureVisible(selected)) {
                    parts.push(`"${selected}" 1`);
                }
            } else {
                for (const tag of group.tags) {
                    if (!isFeatureVisible(tag)) continue;
                    const state = checkStates.get(tag) ?? "inconsistent";
                    if (state === "inconsistent") continue;
                    parts.push(`"${tag}" ${state === "active" ? "1" : "0"}`);
                }
            }
        }
        return parts.join(", ") || "normal";
    }, [checkStates, radioStates, isFeatureVisible]);

    const fontVariationsString = useMemo(() => {
        if (axisValues.size === 0) return "normal";
        const variations = Array.from(axisValues.entries())
            .map(([tag, value]) => `"${tag}" ${value}`)
            .join(", ");
        return variations || "normal";
    }, [axisValues]);

    const bgStyle = useMemo(() => {
        const bgR = Math.round(bgColor.getRed() * 255);
        const bgG = Math.round(bgColor.getGreen() * 255);
        const bgB = Math.round(bgColor.getBlue() * 255);
        return css`
            scrolledwindow& {
                background-color: rgb(${bgR}, ${bgG}, ${bgB});
            }
        `;
    }, [bgColor]);

    const previewStyle = useMemo(() => {
        const fontFamily = fontDesc?.getFamily() ?? "Sans";
        const fgR = Math.round(fgColor.getRed() * 255);
        const fgG = Math.round(fgColor.getGreen() * 255);
        const fgB = Math.round(fgColor.getBlue() * 255);
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
        const fgR = Math.round(fgColor.getRed() * 255);
        const fgG = Math.round(fgColor.getGreen() * 255);
        const fgB = Math.round(fgColor.getBlue() * 255);
        return css`
            textview& {
                font-family: "${fontFamily}";
                font-size: ${size}pt;
                font-feature-settings: ${fontFeaturesString};
                font-variation-settings: ${fontVariationsString};
                color: rgb(${fgR}, ${fgG}, ${fgB});
                letter-spacing: ${letterSpacing / 1024}em;
            }
        `;
    }, [fontDesc, size, fontFeaturesString, fontVariationsString, fgColor, letterSpacing]);

    const createWaterfallStyle = useCallback(
        (wfSize: number) => {
            const fontFamily = fontDesc?.getFamily() ?? "Sans";
            const fgR = Math.round(fgColor.getRed() * 255);
            const fgG = Math.round(fgColor.getGreen() * 255);
            const fgB = Math.round(fgColor.getBlue() * 255);
            return css`
                label& {
                    font-family: "${fontFamily}";
                    font-size: ${wfSize}pt;
                    font-feature-settings: ${fontFeaturesString};
                    font-variation-settings: ${fontVariationsString};
                    color: rgb(${fgR}, ${fgG}, ${fgB});
                    letter-spacing: ${letterSpacing / 1024}em;
                }
            `;
        },
        [fontDesc, fontFeaturesString, fontVariationsString, fgColor, letterSpacing],
    );

    const settingsText = useMemo(() => {
        const parts: string[] = [];
        if (fontFeaturesString !== "normal") {
            parts.push(`font-feature-settings: ${fontFeaturesString};`);
        }
        if (fontVariationsString !== "normal") {
            parts.push(`font-variation-settings: ${fontVariationsString};`);
        }
        return parts.join("\n") || "No active settings";
    }, [fontFeaturesString, fontVariationsString]);

    const pangoFontFeaturesString = useMemo(() => {
        if (fontFeaturesString === "normal") return null;
        return fontFeaturesString.replace(/"/g, "").replace(/ 1/g, "=1").replace(/ 0/g, "=0");
    }, [fontFeaturesString]);

    const pangoFontVariationsString = useMemo(() => {
        if (fontVariationsString === "normal" || axisValues.size === 0) return null;
        return Array.from(axisValues.entries())
            .map(([tag, value]) => `${tag}=${value}`)
            .join(",");
    }, [fontVariationsString, axisValues]);

    const applySelectionAttributes = useCallback(() => {
        const label = previewLabelRef.current;
        if (!label) return;

        if (!pangoFontFeaturesString && !pangoFontVariationsString) {
            label.setAttributes(null);
            return;
        }

        const attrList = new Pango.AttrList();

        const startRef = createRef<number>(0);
        const endRef = createRef<number>(0);
        const hasSelection = label.getSelectionBounds(startRef, endRef);

        const startIndex = hasSelection ? startRef.value : 0;
        const endIndex = hasSelection ? endRef.value : 0xffffffff;

        if (pangoFontFeaturesString) {
            const attr = Pango.attrFontFeaturesNew(pangoFontFeaturesString);
            attr.setStartIndex(startIndex);
            attr.setEndIndex(endIndex);
            attrList.insert(attr);
        }

        if (pangoFontVariationsString) {
            const desc = new Pango.FontDescription();
            desc.setVariations(pangoFontVariationsString);
            const attr = Pango.attrFontDescNew(desc);
            attr.setStartIndex(startIndex);
            attr.setEndIndex(endIndex);
            attrList.insert(attr);
        }

        label.setAttributes(attrList);
    }, [pangoFontFeaturesString, pangoFontVariationsString]);

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
            <x.Slot for="GtkWindow" id="titlebar">
                <GtkHeaderBar>
                    <x.ContainerSlot for={GtkHeaderBar} id="packStart">
                        <GtkButton iconName="view-refresh-symbolic" tooltipText="Reset" onClicked={resetAll} />
                    </x.ContainerSlot>
                </GtkHeaderBar>
            </x.Slot>
            <GtkShortcutController scope={Gtk.ShortcutScope.MANAGED}>
                <x.Shortcut
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
            <GtkBox ref={handleContainerRef}>
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
                                <x.GridChild column={0} row={0}>
                                    <GtkLabel label="Size" xalign={0} valign={Gtk.Align.BASELINE} />
                                </x.GridChild>
                                <x.GridChild column={1} row={0}>
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
                                </x.GridChild>
                                <x.GridChild column={2} row={0}>
                                    <GtkEntry
                                        widthChars={4}
                                        maxWidthChars={4}
                                        valign={Gtk.Align.BASELINE}
                                        text={String(Math.round(size * 10) / 10)}
                                        onActivate={handleSizeEntry}
                                        sensitive={viewMode !== "waterfall"}
                                    />
                                </x.GridChild>

                                <x.GridChild column={0} row={1}>
                                    <GtkLabel label="Letterspacing" xalign={0} valign={Gtk.Align.BASELINE} />
                                </x.GridChild>
                                <x.GridChild column={1} row={1}>
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
                                </x.GridChild>
                                <x.GridChild column={2} row={1}>
                                    <GtkEntry
                                        widthChars={4}
                                        maxWidthChars={4}
                                        valign={Gtk.Align.BASELINE}
                                        text={String(Math.round(letterSpacing))}
                                        onActivate={handleLetterspacingEntry}
                                    />
                                </x.GridChild>

                                <x.GridChild column={0} row={2}>
                                    <GtkLabel label="Line Height" xalign={0} valign={Gtk.Align.BASELINE} />
                                </x.GridChild>
                                <x.GridChild column={1} row={2}>
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
                                </x.GridChild>
                                <x.GridChild column={2} row={2}>
                                    <GtkEntry
                                        widthChars={4}
                                        maxWidthChars={4}
                                        valign={Gtk.Align.BASELINE}
                                        text={String(Math.round(lineHeight * 100) / 100)}
                                        onActivate={handleLineHeightEntry}
                                    />
                                </x.GridChild>

                                <x.GridChild column={0} row={3}>
                                    <GtkLabel label="Foreground" xalign={0} valign={Gtk.Align.BASELINE} />
                                </x.GridChild>
                                <x.GridChild column={1} row={3}>
                                    <GtkColorDialogButton
                                        rgba={fgColor}
                                        onRgbaChanged={setFgColor}
                                        valign={Gtk.Align.BASELINE}
                                    />
                                </x.GridChild>

                                <x.GridChild column={0} row={4}>
                                    <GtkLabel label="Background" xalign={0} valign={Gtk.Align.BASELINE} />
                                </x.GridChild>
                                <x.GridChild column={1} row={4}>
                                    <GtkColorDialogButton
                                        rgba={bgColor}
                                        onRgbaChanged={setBgColor}
                                        valign={Gtk.Align.BASELINE}
                                    />
                                </x.GridChild>

                                <x.GridChild column={2} row={3} rowSpan={2}>
                                    <GtkButton
                                        iconName="object-flip-vertical-symbolic"
                                        halign={Gtk.Align.START}
                                        valign={Gtk.Align.CENTER}
                                        cssClasses={["circular"]}
                                        tooltipText="Swap colors"
                                        onClicked={swapColors}
                                    />
                                </x.GridChild>
                            </GtkGrid>

                            <GtkExpander>
                                <x.Slot for={GtkExpander} id="labelWidget">
                                    <GtkLabel
                                        label="OpenType Features"
                                        xalign={0}
                                        marginTop={10}
                                        marginBottom={10}
                                        cssClasses={["title-4"]}
                                    />
                                </x.Slot>
                                <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                                    {scriptLangItems.length > 0 && (
                                        <GtkDropDown
                                            marginTop={10}
                                            tooltipText="Language System"
                                            selectedId={String(selectedScriptLang)}
                                            onSelectionChanged={(id) => {
                                                handleScriptLangChange(Number.parseInt(id, 10));
                                            }}
                                        >
                                            {scriptLangItems.map((item, i) => (
                                                <x.ListItem
                                                    key={`${item.scriptIndex}-${item.langTag}`}
                                                    id={String(i)}
                                                    value={item.label}
                                                />
                                            ))}
                                        </GtkDropDown>
                                    )}

                                    {FEATURE_GROUPS.map((group) => {
                                        const visibleTags = group.tags.filter(
                                            (t) => t === "xxxx" || isFeatureVisible(t),
                                        );
                                        if (visibleTags.length === 0) return null;
                                        if (
                                            group.type === "radio" &&
                                            visibleTags.filter((t) => t !== "xxxx").length === 0
                                        )
                                            return null;

                                        return (
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
                                                    ? visibleTags.map((tag) => (
                                                          <GtkCheckButton
                                                              key={tag}
                                                              label={getFeatureDisplayName(tag, fontFeatureNames)}
                                                              active={(radioStates.get(group.title) ?? "xxxx") === tag}
                                                              onToggled={() => selectRadio(group.title, tag)}
                                                          />
                                                      ))
                                                    : visibleTags.map((tag) => (
                                                          <GtkCheckButton
                                                              key={tag}
                                                              label={getFeatureDisplayName(tag, fontFeatureNames)}
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
                                        );
                                    })}
                                </GtkBox>
                            </GtkExpander>

                            <GtkExpander>
                                <x.Slot for={GtkExpander} id="labelWidget">
                                    <GtkLabel
                                        label="Variation Axes"
                                        xalign={0}
                                        marginTop={10}
                                        marginBottom={10}
                                        cssClasses={["title-4"]}
                                    />
                                </x.Slot>
                                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={10}>
                                    <GtkGrid columnSpacing={10} rowSpacing={10}>
                                        {namedInstances.length > 0 && [
                                            <x.GridChild key="instance-label" column={0} row={-1}>
                                                <GtkLabel
                                                    label="Instance"
                                                    xalign={0}
                                                    halign={Gtk.Align.START}
                                                    valign={Gtk.Align.BASELINE}
                                                />
                                            </x.GridChild>,
                                            <x.GridChild key="instance-combo" column={1} row={-1} columnSpan={4}>
                                                <GtkDropDown
                                                    halign={Gtk.Align.START}
                                                    valign={Gtk.Align.BASELINE}
                                                    selectedId={String(selectedInstance)}
                                                    onSelectionChanged={(id) =>
                                                        handleInstanceChange(Number.parseInt(id, 10))
                                                    }
                                                >
                                                    <x.ListItem key="empty" id="0" value="" />
                                                    {namedInstances.map((inst, i) => (
                                                        <x.ListItem
                                                            key={inst.name}
                                                            id={String(i + 1)}
                                                            value={inst.name}
                                                        />
                                                    ))}
                                                </GtkDropDown>
                                            </x.GridChild>,
                                        ]}
                                        {variableAxes.map((axis, i) => [
                                            <x.GridChild key={`${axis.tag}-label`} column={0} row={i}>
                                                <GtkLabel label={axis.name} xalign={0} valign={Gtk.Align.BASELINE} />
                                            </x.GridChild>,
                                            <x.GridChild key={`${axis.tag}-scale`} column={1} row={i}>
                                                <GtkScale
                                                    ref={(scale: Gtk.Scale | null) => {
                                                        if (scale) {
                                                            scale.clearMarks();
                                                            scale.addMark(
                                                                axis.defaultValue,
                                                                Gtk.PositionType.TOP,
                                                                null,
                                                            );
                                                        }
                                                    }}
                                                    hexpand
                                                    widthRequest={100}
                                                    valign={Gtk.Align.BASELINE}
                                                    value={axisValues.get(axis.tag) ?? axis.defaultValue}
                                                    lower={axis.minValue}
                                                    upper={axis.maxValue}
                                                    onValueChanged={(val) => updateAxisValue(axis.tag, val)}
                                                />
                                            </x.GridChild>,
                                            <x.GridChild key={`${axis.tag}-entry`} column={2} row={i}>
                                                <GtkEntry
                                                    widthChars={4}
                                                    maxWidthChars={4}
                                                    valign={Gtk.Align.BASELINE}
                                                    text={String(
                                                        Math.round(
                                                            (axisValues.get(axis.tag) ?? axis.defaultValue) * 10,
                                                        ) / 10,
                                                    )}
                                                    onActivate={(entry: Gtk.Entry) => {
                                                        const val = Number.parseFloat(entry.getText());
                                                        if (Number.isFinite(val)) {
                                                            updateAxisValue(
                                                                axis.tag,
                                                                Math.max(axis.minValue, Math.min(axis.maxValue, val)),
                                                            );
                                                        }
                                                    }}
                                                />
                                            </x.GridChild>,
                                            <x.GridChild key={`${axis.tag}-anim`} column={3} row={i}>
                                                <GtkToggleButton
                                                    iconName={
                                                        animatingAxes.has(axis.tag)
                                                            ? "media-playback-stop"
                                                            : "media-playback-start"
                                                    }
                                                    active={animatingAxes.has(axis.tag)}
                                                    valign={Gtk.Align.BASELINE}
                                                    onToggled={() => toggleAxisAnimation(axis)}
                                                />
                                            </x.GridChild>,
                                        ])}
                                    </GtkGrid>
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
                            <x.StackPage id="label">
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
                            </x.StackPage>
                            <x.StackPage id="entry">
                                <GtkTextView
                                    ref={editTextViewRef}
                                    cssClasses={[editStyle]}
                                    wrapMode={Gtk.WrapMode.WORD}
                                    valign={Gtk.Align.FILL}
                                />
                            </x.StackPage>
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
        "harfbuzz",
        "variable fonts",
        "font-feature-settings",
        "font-variation-settings",
        "css",
    ],
    component: FontFeaturesDemo,
    sourceCode,
    defaultWidth: 600,
    defaultHeight: 500,
};
