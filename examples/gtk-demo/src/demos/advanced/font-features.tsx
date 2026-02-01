import { css } from "@gtkx/css";
import { createRef } from "@gtkx/ffi";
import * as Gdk from "@gtkx/ffi/gdk";
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
    GtkFrame,
    GtkLabel,
    GtkScale,
    GtkScrolledWindow,
    x,
} from "@gtkx/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./font-features.tsx?raw";

interface DiscoveredFeature {
    tag: string;
    name: string;
    description: string;
    category: string;
}

interface AxisInfo {
    tag: string;
    name: string;
    minValue: number;
    defaultValue: number;
    maxValue: number;
}

interface ScriptInfo {
    tag: string;
    name: string;
    index: number;
}

interface LanguageInfo {
    tag: string;
    name: string;
    index: number;
}

const FEATURE_CATEGORIES = {
    ligatures: "Ligatures",
    casing: "Letter Case",
    figures: "Numeric Figures",
    fractions: "Fractions",
    stylistic: "Stylistic",
    spacing: "Spacing & Positioning",
    other: "Other Features",
} as const;

const FEATURE_INFO: Record<string, { name: string; description: string; category: string }> = {
    liga: { name: "Standard Ligatures", description: "Common ligatures like fi, fl, ff", category: "ligatures" },
    clig: { name: "Contextual Ligatures", description: "Context-dependent ligatures", category: "ligatures" },
    dlig: { name: "Discretionary Ligatures", description: "Optional stylistic ligatures", category: "ligatures" },
    hlig: { name: "Historical Ligatures", description: "Historical ligature forms", category: "ligatures" },
    rlig: {
        name: "Required Ligatures",
        description: "Ligatures required for correct rendering",
        category: "ligatures",
    },

    smcp: { name: "Small Caps", description: "Lowercase letters as small capitals", category: "casing" },
    c2sc: { name: "Caps to Small Caps", description: "Uppercase letters as small capitals", category: "casing" },
    pcap: { name: "Petite Caps", description: "Smaller small capitals", category: "casing" },
    c2pc: { name: "Caps to Petite Caps", description: "Uppercase to petite capitals", category: "casing" },
    unic: { name: "Unicase", description: "Mixed case alphabet", category: "casing" },
    titl: { name: "Titling", description: "Titling alternates for capital letters", category: "casing" },

    lnum: { name: "Lining Figures", description: "Numbers aligned to baseline", category: "figures" },
    onum: { name: "Oldstyle Figures", description: "Numbers with varying heights", category: "figures" },
    pnum: { name: "Proportional Figures", description: "Variable-width numbers", category: "figures" },
    tnum: { name: "Tabular Figures", description: "Fixed-width numbers for tables", category: "figures" },

    frac: { name: "Fractions", description: "Diagonal fractions like 1/2", category: "fractions" },
    afrc: { name: "Alternative Fractions", description: "Stacked fractions", category: "fractions" },
    numr: { name: "Numerators", description: "Numerator forms", category: "fractions" },
    dnom: { name: "Denominators", description: "Denominator forms", category: "fractions" },

    salt: { name: "Stylistic Alternates", description: "Alternative letterforms", category: "stylistic" },
    calt: { name: "Contextual Alternates", description: "Context-dependent letter forms", category: "stylistic" },
    swsh: { name: "Swash", description: "Decorative swash variants", category: "stylistic" },
    cswh: { name: "Contextual Swash", description: "Context-dependent swash", category: "stylistic" },
    hist: { name: "Historical Forms", description: "Historical character forms", category: "stylistic" },
    ss01: { name: "Stylistic Set 1", description: "Alternative character designs", category: "stylistic" },
    ss02: { name: "Stylistic Set 2", description: "Alternative character designs", category: "stylistic" },
    ss03: { name: "Stylistic Set 3", description: "Alternative character designs", category: "stylistic" },
    ss04: { name: "Stylistic Set 4", description: "Alternative character designs", category: "stylistic" },
    ss05: { name: "Stylistic Set 5", description: "Alternative character designs", category: "stylistic" },
    ss06: { name: "Stylistic Set 6", description: "Alternative character designs", category: "stylistic" },
    ss07: { name: "Stylistic Set 7", description: "Alternative character designs", category: "stylistic" },
    ss08: { name: "Stylistic Set 8", description: "Alternative character designs", category: "stylistic" },
    ss09: { name: "Stylistic Set 9", description: "Alternative character designs", category: "stylistic" },
    ss10: { name: "Stylistic Set 10", description: "Alternative character designs", category: "stylistic" },
    ss11: { name: "Stylistic Set 11", description: "Alternative character designs", category: "stylistic" },
    ss12: { name: "Stylistic Set 12", description: "Alternative character designs", category: "stylistic" },
    ss13: { name: "Stylistic Set 13", description: "Alternative character designs", category: "stylistic" },
    ss14: { name: "Stylistic Set 14", description: "Alternative character designs", category: "stylistic" },
    ss15: { name: "Stylistic Set 15", description: "Alternative character designs", category: "stylistic" },
    ss16: { name: "Stylistic Set 16", description: "Alternative character designs", category: "stylistic" },
    ss17: { name: "Stylistic Set 17", description: "Alternative character designs", category: "stylistic" },
    ss18: { name: "Stylistic Set 18", description: "Alternative character designs", category: "stylistic" },
    ss19: { name: "Stylistic Set 19", description: "Alternative character designs", category: "stylistic" },
    ss20: { name: "Stylistic Set 20", description: "Alternative character designs", category: "stylistic" },

    ordn: { name: "Ordinals", description: "Superscript for ordinals (1st, 2nd)", category: "spacing" },
    sups: { name: "Superscript", description: "Superscript characters", category: "spacing" },
    subs: { name: "Subscript", description: "Subscript characters", category: "spacing" },
    sinf: {
        name: "Scientific Inferiors",
        description: "Subscript figures for scientific notation",
        category: "spacing",
    },
    zero: { name: "Slashed Zero", description: "Zero with a slash or dot", category: "spacing" },
    kern: { name: "Kerning", description: "Adjust spacing between glyphs", category: "spacing" },
    cpsp: { name: "Capital Spacing", description: "Adjust spacing for capitals", category: "spacing" },
    case: { name: "Case-Sensitive Forms", description: "Adjust punctuation for capitals", category: "spacing" },
};

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

const WATERFALL_SIZES = [7, 8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 30, 36, 48, 60, 72, 90];

const SCRIPT_NAMES: Record<string, string> = {
    DFLT: "Default",
    latn: "Latin",
    grek: "Greek",
    cyrl: "Cyrillic",
    arab: "Arabic",
    hebr: "Hebrew",
    thai: "Thai",
    deva: "Devanagari",
    beng: "Bengali",
    guru: "Gurmukhi",
    gujr: "Gujarati",
    orya: "Oriya",
    taml: "Tamil",
    telu: "Telugu",
    knda: "Kannada",
    mlym: "Malayalam",
    sinh: "Sinhala",
    mymr: "Myanmar",
    geor: "Georgian",
    hang: "Hangul",
    ethi: "Ethiopic",
    cher: "Cherokee",
    cans: "Canadian Aboriginal",
    ogam: "Ogham",
    runr: "Runic",
    khmr: "Khmer",
    mong: "Mongolian",
    hira: "Hiragana",
    kana: "Katakana",
    bopo: "Bopomofo",
    hani: "Han",
    yi: "Yi",
    tibt: "Tibetan",
};

const LANGUAGE_NAMES: Record<string, string> = {
    dflt: "Default",
    DEU: "German",
    ENG: "English",
    ESP: "Spanish",
    FRA: "French",
    ITA: "Italian",
    NLD: "Dutch",
    POL: "Polish",
    POR: "Portuguese",
    ROM: "Romanian",
    RUS: "Russian",
    TRK: "Turkish",
    ARA: "Arabic",
    HIN: "Hindi",
    JPN: "Japanese",
    KOR: "Korean",
    ZHS: "Chinese Simplified",
    ZHT: "Chinese Traditional",
    VIT: "Vietnamese",
};

type ViewMode = "features" | "waterfall";

const TAG_GSUB = ((71 << 24) | (83 << 16) | (85 << 8) | 66) >>> 0;
const TAG_GPOS = ((71 << 24) | (80 << 16) | (79 << 8) | 83) >>> 0;

const tagToString = (tag: number): string => {
    return String.fromCharCode((tag >> 24) & 0xff, (tag >> 16) & 0xff, (tag >> 8) & 0xff, tag & 0xff);
};

const discoverFontFeatures = (face: HarfBuzz.FaceT): DiscoveredFeature[] => {
    const features = new Map<string, DiscoveredFeature>();

    for (const tableTag of [TAG_GSUB, TAG_GPOS]) {
        const featureTagsRef = createRef<number[]>(new Array(100).fill(0));
        const featureCountRef = createRef<number>(100);

        let startOffset = 0;
        let totalFeatures = 0;

        do {
            featureTagsRef.value = new Array(100).fill(0);
            featureCountRef.value = 100;

            totalFeatures = HarfBuzz.otLayoutTableGetFeatureTags(
                face,
                tableTag,
                startOffset,
                featureTagsRef,
                featureCountRef,
            );

            const count = featureCountRef.value;
            for (let i = 0; i < count; i++) {
                const tag = featureTagsRef.value[i] ?? 0;
                if (tag === 0) continue;

                const tagStr = tagToString(tag);
                if (features.has(tagStr)) continue;

                const info = FEATURE_INFO[tagStr];
                if (info) {
                    features.set(tagStr, {
                        tag: tagStr,
                        name: info.name,
                        description: info.description,
                        category: info.category,
                    });
                } else {
                    features.set(tagStr, {
                        tag: tagStr,
                        name: tagStr.toUpperCase(),
                        description: `OpenType feature ${tagStr}`,
                        category: "other",
                    });
                }
            }

            startOffset += count;
        } while (startOffset < totalFeatures);
    }

    return Array.from(features.values()).sort((a, b) => {
        const categoryOrder = Object.keys(FEATURE_CATEGORIES);
        const catDiff = categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category);
        if (catDiff !== 0) return catDiff;
        return a.tag.localeCompare(b.tag);
    });
};

const discoverVariableAxes = (face: HarfBuzz.FaceT): AxisInfo[] => {
    const hasData = HarfBuzz.otVarHasData(face);
    if (!hasData) return [];

    const axisCount = HarfBuzz.otVarGetAxisCount(face);
    if (axisCount === 0) return [];

    const axes: AxisInfo[] = [];
    for (let i = 0; i < axisCount; i++) {
        const axisInfo = new HarfBuzz.OtVarAxisInfoT();
        HarfBuzz.otVarFindAxisInfo(face, 0, axisInfo);

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

const discoverScripts = (face: HarfBuzz.FaceT): ScriptInfo[] => {
    const scripts = new Map<string, ScriptInfo>();

    for (const tableTag of [TAG_GSUB, TAG_GPOS]) {
        const scriptTagsRef = createRef<number[]>(new Array(50).fill(0));
        const scriptCountRef = createRef<number>(50);

        let startOffset = 0;
        let totalScripts = 0;

        do {
            scriptTagsRef.value = new Array(50).fill(0);
            scriptCountRef.value = 50;

            totalScripts = HarfBuzz.otLayoutTableGetScriptTags(
                face,
                tableTag,
                startOffset,
                scriptTagsRef,
                scriptCountRef,
            );

            const count = scriptCountRef.value;
            for (let i = 0; i < count; i++) {
                const tag = scriptTagsRef.value[i] ?? 0;
                if (tag === 0) continue;

                const tagStr = tagToString(tag);
                if (scripts.has(tagStr)) continue;

                scripts.set(tagStr, {
                    tag: tagStr,
                    name: SCRIPT_NAMES[tagStr] ?? tagStr,
                    index: scripts.size,
                });
            }

            startOffset += count;
        } while (startOffset < totalScripts);
    }

    return Array.from(scripts.values());
};

const discoverLanguages = (face: HarfBuzz.FaceT, scriptIndex: number): LanguageInfo[] => {
    const languages: LanguageInfo[] = [{ tag: "dflt", name: "Default", index: 0xffff }];

    for (const tableTag of [TAG_GSUB, TAG_GPOS]) {
        const langTagsRef = createRef<number[]>(new Array(50).fill(0));
        const langCountRef = createRef<number>(50);

        let startOffset = 0;
        let totalLangs = 0;

        do {
            langTagsRef.value = new Array(50).fill(0);
            langCountRef.value = 50;

            totalLangs = HarfBuzz.otLayoutScriptGetLanguageTags(
                face,
                tableTag,
                scriptIndex,
                startOffset,
                langTagsRef,
                langCountRef,
            );

            const count = langCountRef.value;
            for (let i = 0; i < count; i++) {
                const tag = langTagsRef.value[i] ?? 0;
                if (tag === 0) continue;

                const tagStr = tagToString(tag);
                const existing = languages.find((l) => l.tag === tagStr);
                if (existing) continue;

                languages.push({
                    tag: tagStr,
                    name: LANGUAGE_NAMES[tagStr] ?? tagStr,
                    index: languages.length - 1,
                });
            }

            startOffset += count;
        } while (startOffset < totalLangs);
    }

    return languages;
};

const DEFAULT_PREVIEW_TEXT = "The quick brown fox jumps over the lazy dog. 0123456789 fi fl ff ffi";

const createDefaultFgColor = () => new Gdk.RGBA({ red: 0, green: 0, blue: 0, alpha: 1 });
const createDefaultBgColor = () => new Gdk.RGBA({ red: 1, green: 1, blue: 1, alpha: 1 });
const createDefaultFontDesc = () => Pango.FontDescription.fromString("Sans 24");

const FontFeaturesDemo = () => {
    const [fontDesc, setFontDesc] = useState<Pango.FontDescription | null>(createDefaultFontDesc);
    const [enabledFeatures, setEnabledFeatures] = useState<Set<string>>(new Set(["liga", "kern"]));
    const [previewText, setPreviewText] = useState(DEFAULT_PREVIEW_TEXT);
    const [availableFeatures, setAvailableFeatures] = useState<DiscoveredFeature[]>([]);
    const [variableAxes, setVariableAxes] = useState<AxisInfo[]>([]);
    const [axisValues, setAxisValues] = useState<Map<string, number>>(new Map());
    const [fgColor, setFgColor] = useState<Gdk.RGBA>(createDefaultFgColor);
    const [bgColor, setBgColor] = useState<Gdk.RGBA>(createDefaultBgColor);
    const [letterSpacing, setLetterSpacing] = useState(0);
    const [lineHeight, setLineHeight] = useState(1.0);
    const [viewMode, setViewMode] = useState<ViewMode>("features");
    const [availableScripts, setAvailableScripts] = useState<ScriptInfo[]>([]);
    const [selectedScript, setSelectedScript] = useState<ScriptInfo | null>(null);
    const [availableLanguages, setAvailableLanguages] = useState<LanguageInfo[]>([]);
    const [selectedLanguage, setSelectedLanguage] = useState<LanguageInfo | null>(null);
    const containerRef = useRef<Gtk.Box | null>(null);
    const currentFaceRef = useRef<HarfBuzz.FaceT | null>(null);

    const discoverFontInfo = useCallback(() => {
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

            const features = discoverFontFeatures(face);
            setAvailableFeatures(features);

            const axes = discoverVariableAxes(face);
            setVariableAxes(axes);

            const defaultValues = new Map<string, number>();
            for (const axis of axes) {
                defaultValues.set(axis.tag, axis.defaultValue);
            }
            setAxisValues(defaultValues);

            const scripts = discoverScripts(face);
            setAvailableScripts(scripts);
            if (scripts.length > 0) {
                setSelectedScript(scripts[0] ?? null);
                const languages = discoverLanguages(face, scripts[0]?.index ?? 0);
                setAvailableLanguages(languages);
                setSelectedLanguage(languages[0] ?? null);
            } else {
                setSelectedScript(null);
                setAvailableLanguages([]);
                setSelectedLanguage(null);
            }
        } catch {
            setAvailableFeatures([]);
            setVariableAxes([]);
            setAxisValues(new Map());
            setAvailableScripts([]);
            setSelectedScript(null);
            setAvailableLanguages([]);
            setSelectedLanguage(null);
            currentFaceRef.current = null;
        }
    }, [fontDesc]);

    useEffect(() => {
        if (containerRef.current) {
            discoverFontInfo();
        }
    }, [discoverFontInfo]);

    const toggleFeature = (tag: string) => {
        setEnabledFeatures((prev) => {
            const next = new Set(prev);
            if (next.has(tag)) {
                next.delete(tag);
            } else {
                next.add(tag);
            }
            return next;
        });
    };

    const updateAxisValue = (tag: string, value: number) => {
        setAxisValues((prev) => {
            const next = new Map(prev);
            next.set(tag, value);
            return next;
        });
    };

    const resetAxes = () => {
        const defaultValues = new Map<string, number>();
        for (const axis of variableAxes) {
            defaultValues.set(axis.tag, axis.defaultValue);
        }
        setAxisValues(defaultValues);
    };

    const handleScriptChange = (script: ScriptInfo) => {
        setSelectedScript(script);
        if (currentFaceRef.current) {
            const languages = discoverLanguages(currentFaceRef.current, script.index);
            setAvailableLanguages(languages);
            setSelectedLanguage(languages[0] ?? null);
        }
    };

    const resetAppearance = () => {
        setFgColor(createDefaultFgColor());
        setBgColor(createDefaultBgColor());
        setLetterSpacing(0);
        setLineHeight(1.0);
    };

    const fontFeaturesString = useMemo(() => {
        const features = Array.from(enabledFeatures)
            .map((tag) => `"${tag}" 1`)
            .join(", ");
        return features || "normal";
    }, [enabledFeatures]);

    const fontVariationsString = useMemo(() => {
        if (axisValues.size === 0) return "normal";
        const variations = Array.from(axisValues.entries())
            .map(([tag, value]) => `"${tag}" ${value}`)
            .join(", ");
        return variations || "normal";
    }, [axisValues]);

    const previewStyle = useMemo(() => {
        const fontFamily = fontDesc?.getFamily() ?? "Sans";
        const fontSize = fontDesc?.getSize() ? fontDesc.getSize() / 1024 : 24;

        const fgR = Math.round(fgColor.getRed() * 255);
        const fgG = Math.round(fgColor.getGreen() * 255);
        const fgB = Math.round(fgColor.getBlue() * 255);
        const bgR = Math.round(bgColor.getRed() * 255);
        const bgG = Math.round(bgColor.getGreen() * 255);
        const bgB = Math.round(bgColor.getBlue() * 255);

        return css`
            label& {
                font-family: "${fontFamily}";
                font-size: ${fontSize}pt;
                font-feature-settings: ${fontFeaturesString};
                font-variation-settings: ${fontVariationsString};
                color: rgb(${fgR}, ${fgG}, ${fgB});
                background-color: rgb(${bgR}, ${bgG}, ${bgB});
                letter-spacing: ${letterSpacing / 1024}em;
                line-height: ${lineHeight};
                padding: 16px;
            }
        `;
    }, [fontDesc, fontFeaturesString, fontVariationsString, fgColor, bgColor, letterSpacing, lineHeight]);

    const createWaterfallStyle = useCallback(
        (size: number) => {
            const fontFamily = fontDesc?.getFamily() ?? "Sans";
            const fgR = Math.round(fgColor.getRed() * 255);
            const fgG = Math.round(fgColor.getGreen() * 255);
            const fgB = Math.round(fgColor.getBlue() * 255);
            const bgR = Math.round(bgColor.getRed() * 255);
            const bgG = Math.round(bgColor.getGreen() * 255);
            const bgB = Math.round(bgColor.getBlue() * 255);

            return css`
                label& {
                    font-family: "${fontFamily}";
                    font-size: ${size}pt;
                    font-feature-settings: ${fontFeaturesString};
                    font-variation-settings: ${fontVariationsString};
                    color: rgb(${fgR}, ${fgG}, ${fgB});
                    background-color: rgb(${bgR}, ${bgG}, ${bgB});
                    letter-spacing: ${letterSpacing / 1024}em;
                }
            `;
        },
        [fontDesc, fontFeaturesString, fontVariationsString, fgColor, bgColor, letterSpacing],
    );

    const featuresByCategory = useMemo(() => {
        const grouped = new Map<string, DiscoveredFeature[]>();
        for (const feature of availableFeatures) {
            const existing = grouped.get(feature.category) ?? [];
            existing.push(feature);
            grouped.set(feature.category, existing);
        }
        return grouped;
    }, [availableFeatures]);

    const handleContainerRef = useCallback(
        (widget: Gtk.Box | null) => {
            containerRef.current = widget;
            if (widget && fontDesc) {
                discoverFontInfo();
            }
        },
        [fontDesc, discoverFontInfo],
    );

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={16} ref={handleContainerRef}>
            <GtkLabel label="Font Explorer" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="Explore OpenType font features and variable font axes. Select a font to discover its capabilities."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkFrame label="Font Selection">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkBox spacing={12}>
                        <GtkLabel label="Font:" widthRequest={80} halign={Gtk.Align.START} />
                        <GtkFontDialogButton
                            fontDesc={fontDesc}
                            onFontDescChanged={setFontDesc}
                            title="Select Font"
                            useFont
                            useSize
                            hexpand
                        />
                    </GtkBox>
                    {fontDesc && (
                        <GtkLabel
                            label={`Selected: ${fontDesc.toString()}`}
                            cssClasses={["dim-label", "monospace"]}
                            halign={Gtk.Align.START}
                            ellipsize={3}
                        />
                    )}
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Preview">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkBox spacing={12}>
                        <GtkEntry
                            text={previewText}
                            onChanged={(entry: Gtk.Entry) => setPreviewText(entry.getText())}
                            placeholderText="Enter preview text..."
                            hexpand
                        />
                        <GtkBox spacing={0} cssClasses={["linked"]}>
                            <GtkButton
                                label="Features"
                                cssClasses={viewMode === "features" ? ["suggested-action"] : []}
                                onClicked={() => setViewMode("features")}
                            />
                            <GtkButton
                                label="Waterfall"
                                cssClasses={viewMode === "waterfall" ? ["suggested-action"] : []}
                                onClicked={() => setViewMode("waterfall")}
                            />
                        </GtkBox>
                    </GtkBox>

                    {viewMode === "features" ? (
                        <>
                            <GtkBox cssClasses={["card"]} marginTop={8} marginBottom={8}>
                                <GtkLabel
                                    label={previewText || DEFAULT_PREVIEW_TEXT}
                                    cssClasses={[previewStyle]}
                                    wrap
                                    halign={Gtk.Align.START}
                                    marginTop={16}
                                    marginBottom={16}
                                    marginStart={16}
                                    marginEnd={16}
                                    selectable
                                />
                            </GtkBox>

                            <GtkLabel
                                label={`Active features: ${Array.from(enabledFeatures).join(", ") || "none"}`}
                                cssClasses={["dim-label", "monospace"]}
                                halign={Gtk.Align.START}
                            />
                        </>
                    ) : (
                        <GtkScrolledWindow heightRequest={400} hscrollbarPolicy={Gtk.PolicyType.NEVER}>
                            <GtkBox
                                orientation={Gtk.Orientation.VERTICAL}
                                spacing={4}
                                cssClasses={["card"]}
                                marginTop={8}
                                marginBottom={8}
                            >
                                {WATERFALL_SIZES.map((size) => (
                                    <GtkBox
                                        key={size}
                                        spacing={8}
                                        marginStart={12}
                                        marginEnd={12}
                                        marginTop={4}
                                        marginBottom={4}
                                    >
                                        <GtkLabel
                                            label={`${size}pt`}
                                            widthRequest={48}
                                            cssClasses={["dim-label", "monospace"]}
                                            halign={Gtk.Align.END}
                                            valign={Gtk.Align.START}
                                        />
                                        <GtkLabel
                                            label={previewText || DEFAULT_PREVIEW_TEXT}
                                            cssClasses={[createWaterfallStyle(size)]}
                                            wrap
                                            halign={Gtk.Align.START}
                                            hexpand
                                            selectable
                                        />
                                    </GtkBox>
                                ))}
                            </GtkBox>
                        </GtkScrolledWindow>
                    )}
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Appearance">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkBox spacing={8} halign={Gtk.Align.END}>
                        <GtkButton label="Reset" onClicked={resetAppearance} />
                    </GtkBox>

                    <GtkBox spacing={12}>
                        <GtkLabel label="Foreground:" widthRequest={100} halign={Gtk.Align.START} />
                        <GtkColorDialogButton
                            rgba={fgColor}
                            onRgbaChanged={setFgColor}
                            title="Select Foreground Color"
                        />
                    </GtkBox>

                    <GtkBox spacing={12}>
                        <GtkLabel label="Background:" widthRequest={100} halign={Gtk.Align.START} />
                        <GtkColorDialogButton
                            rgba={bgColor}
                            onRgbaChanged={setBgColor}
                            title="Select Background Color"
                        />
                    </GtkBox>

                    <GtkBox spacing={12}>
                        <GtkLabel label="Letter Spacing:" widthRequest={100} halign={Gtk.Align.START} />
                        <GtkScale
                            hexpand
                            drawValue
                            valuePos={Gtk.PositionType.RIGHT}
                            value={letterSpacing}
                            lower={-1024}
                            upper={8192}
                            stepIncrement={64}
                            pageIncrement={256}
                            onValueChanged={setLetterSpacing}
                        />
                    </GtkBox>

                    <GtkBox spacing={12}>
                        <GtkLabel label="Line Height:" widthRequest={100} halign={Gtk.Align.START} />
                        <GtkScale
                            hexpand
                            drawValue
                            valuePos={Gtk.PositionType.RIGHT}
                            value={lineHeight}
                            lower={0.75}
                            upper={2.5}
                            stepIncrement={0.05}
                            pageIncrement={0.25}
                            onValueChanged={setLineHeight}
                        />
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            {availableScripts.length > 0 && (
                <GtkFrame label="Script & Language">
                    <GtkBox
                        orientation={Gtk.Orientation.VERTICAL}
                        spacing={12}
                        marginTop={12}
                        marginBottom={12}
                        marginStart={12}
                        marginEnd={12}
                    >
                        <GtkBox spacing={12}>
                            <GtkLabel label="Script:" widthRequest={80} halign={Gtk.Align.START} />
                            <GtkDropDown
                                hexpand
                                selectedId={selectedScript?.tag}
                                onSelectionChanged={(id) => {
                                    const script = availableScripts.find((s) => s.tag === id);
                                    if (script) handleScriptChange(script);
                                }}
                            >
                                {availableScripts.map((script) => (
                                    <x.ListItem
                                        key={script.tag}
                                        id={script.tag}
                                        value={`${script.name} (${script.tag})`}
                                    />
                                ))}
                            </GtkDropDown>
                        </GtkBox>

                        <GtkBox spacing={12}>
                            <GtkLabel label="Language:" widthRequest={80} halign={Gtk.Align.START} />
                            <GtkDropDown
                                hexpand
                                selectedId={selectedLanguage?.tag}
                                onSelectionChanged={(id) => {
                                    const lang = availableLanguages.find((l) => l.tag === id);
                                    if (lang) setSelectedLanguage(lang);
                                }}
                            >
                                {availableLanguages.map((lang) => (
                                    <x.ListItem key={lang.tag} id={lang.tag} value={`${lang.name} (${lang.tag})`} />
                                ))}
                            </GtkDropDown>
                        </GtkBox>

                        <GtkLabel
                            label={`Script: ${selectedScript?.tag ?? "none"}, Language: ${selectedLanguage?.tag ?? "dflt"}`}
                            cssClasses={["dim-label", "monospace"]}
                            halign={Gtk.Align.START}
                        />
                    </GtkBox>
                </GtkFrame>
            )}

            {variableAxes.length > 0 && (
                <GtkFrame label="Variable Font Axes">
                    <GtkBox
                        orientation={Gtk.Orientation.VERTICAL}
                        spacing={12}
                        marginTop={12}
                        marginBottom={12}
                        marginStart={12}
                        marginEnd={12}
                    >
                        <GtkBox spacing={8} halign={Gtk.Align.END}>
                            <GtkButton label="Reset to Defaults" onClicked={resetAxes} />
                        </GtkBox>
                        {variableAxes.map((axis) => (
                            <GtkBox key={axis.tag} spacing={12}>
                                <GtkLabel label={axis.name} widthRequest={120} halign={Gtk.Align.START} />
                                <GtkScale
                                    hexpand
                                    drawValue
                                    valuePos={Gtk.PositionType.RIGHT}
                                    value={axisValues.get(axis.tag) ?? axis.defaultValue}
                                    lower={axis.minValue}
                                    upper={axis.maxValue}
                                    onValueChanged={(val) => updateAxisValue(axis.tag, val)}
                                />
                            </GtkBox>
                        ))}
                        <GtkLabel
                            label={`font-variation-settings: ${fontVariationsString};`}
                            cssClasses={["dim-label", "monospace"]}
                            halign={Gtk.Align.START}
                            marginTop={8}
                        />
                    </GtkBox>
                </GtkFrame>
            )}

            <GtkFrame label="Font Features">
                <GtkScrolledWindow
                    heightRequest={variableAxes.length > 0 ? 250 : 350}
                    hscrollbarPolicy={Gtk.PolicyType.NEVER}
                >
                    <GtkBox
                        orientation={Gtk.Orientation.VERTICAL}
                        spacing={8}
                        marginTop={12}
                        marginBottom={12}
                        marginStart={12}
                        marginEnd={12}
                    >
                        {availableFeatures.length === 0 ? (
                            <GtkLabel
                                label={
                                    fontDesc
                                        ? "No OpenType features found in this font."
                                        : "Select a font to discover its available features."
                                }
                                cssClasses={["dim-label"]}
                                halign={Gtk.Align.CENTER}
                                marginTop={24}
                                marginBottom={24}
                            />
                        ) : (
                            Array.from(featuresByCategory.entries()).map(([category, features]) => (
                                <GtkExpander
                                    key={category}
                                    label={`${FEATURE_CATEGORIES[category as keyof typeof FEATURE_CATEGORIES]} (${features.length})`}
                                    expanded={category === "ligatures" || category === "figures"}
                                >
                                    <GtkBox
                                        orientation={Gtk.Orientation.VERTICAL}
                                        spacing={6}
                                        marginStart={12}
                                        marginTop={8}
                                    >
                                        {features.map((feature) => (
                                            <GtkBox key={feature.tag} spacing={12}>
                                                <GtkCheckButton
                                                    active={enabledFeatures.has(feature.tag)}
                                                    onToggled={() => toggleFeature(feature.tag)}
                                                />
                                                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={2} hexpand>
                                                    <GtkBox spacing={8}>
                                                        <GtkLabel
                                                            label={feature.tag}
                                                            cssClasses={["monospace", "dim-label"]}
                                                            halign={Gtk.Align.START}
                                                            widthRequest={40}
                                                        />
                                                        <GtkLabel
                                                            label={feature.name}
                                                            cssClasses={["heading"]}
                                                            halign={Gtk.Align.START}
                                                        />
                                                    </GtkBox>
                                                    <GtkLabel
                                                        label={feature.description}
                                                        cssClasses={["dim-label"]}
                                                        halign={Gtk.Align.START}
                                                    />
                                                </GtkBox>
                                            </GtkBox>
                                        ))}
                                    </GtkBox>
                                </GtkExpander>
                            ))
                        )}
                    </GtkBox>
                </GtkScrolledWindow>
            </GtkFrame>

            <GtkFrame label="CSS Output">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={8}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel label="Generated CSS:" halign={Gtk.Align.START} />
                    <GtkLabel
                        label={`font-feature-settings: ${fontFeaturesString};`}
                        cssClasses={["monospace", "card"]}
                        halign={Gtk.Align.START}
                        selectable
                        marginTop={4}
                        marginBottom={4}
                        marginStart={8}
                        marginEnd={8}
                    />
                    {variableAxes.length > 0 && (
                        <GtkLabel
                            label={`font-variation-settings: ${fontVariationsString};`}
                            cssClasses={["monospace", "card"]}
                            halign={Gtk.Align.START}
                            selectable
                            marginTop={4}
                            marginBottom={4}
                            marginStart={8}
                            marginEnd={8}
                        />
                    )}
                </GtkBox>
            </GtkFrame>
        </GtkBox>
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
};
