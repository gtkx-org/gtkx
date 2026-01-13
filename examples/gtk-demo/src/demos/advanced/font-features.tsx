import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkCheckButton, GtkFrame, GtkLabel, GtkScrolledWindow } from "@gtkx/react";
import { useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./font-features.tsx?raw";

interface FontFeature {
    tag: string;
    name: string;
    description: string;
}

const fontFeatures: FontFeature[] = [
    { tag: "liga", name: "Standard Ligatures", description: "Common ligatures like fi, fl, ff" },
    { tag: "dlig", name: "Discretionary Ligatures", description: "Optional stylistic ligatures" },
    { tag: "calt", name: "Contextual Alternates", description: "Context-dependent letter forms" },
    { tag: "smcp", name: "Small Caps", description: "Lowercase letters as small capitals" },
    { tag: "c2sc", name: "Caps to Small Caps", description: "Uppercase letters as small capitals" },
    { tag: "onum", name: "Oldstyle Figures", description: "Numbers with varying heights" },
    { tag: "lnum", name: "Lining Figures", description: "Numbers aligned to baseline" },
    { tag: "tnum", name: "Tabular Figures", description: "Fixed-width numbers for tables" },
    { tag: "pnum", name: "Proportional Figures", description: "Variable-width numbers" },
    { tag: "frac", name: "Fractions", description: "Diagonal fractions like 1/2" },
    { tag: "ordn", name: "Ordinals", description: "Superscript for ordinals (1st, 2nd)" },
    { tag: "sups", name: "Superscript", description: "Superscript characters" },
    { tag: "subs", name: "Subscript", description: "Subscript characters" },
    { tag: "zero", name: "Slashed Zero", description: "Zero with a slash or dot" },
    { tag: "ss01", name: "Stylistic Set 1", description: "Alternative character designs" },
    { tag: "ss02", name: "Stylistic Set 2", description: "Alternative character designs" },
    { tag: "swsh", name: "Swash", description: "Decorative swash variants" },
    { tag: "cswh", name: "Contextual Swash", description: "Context-dependent swash" },
    { tag: "hist", name: "Historical Forms", description: "Historical character forms" },
    { tag: "salt", name: "Stylistic Alternates", description: "Alternative letterforms" },
];

const sampleTexts = {
    ligatures: "Office Affluent Fjord Difficult",
    smallcaps: "The Quick Brown Fox",
    figures: "0123456789 $1,234.56",
    fractions: "1/2 1/4 3/4 1/8 5/8",
    ordinals: "1st 2nd 3rd 4th",
    superscript: "H2O CO2 E=mc2",
    mixed: "Typography 0123456789 fi fl ff",
};

const FontFeaturesDemo = () => {
    const [enabledFeatures, setEnabledFeatures] = useState<Set<string>>(new Set(["liga"]));

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

    const getFontFeaturesString = () => {
        const features = Array.from(enabledFeatures)
            .map((tag) => `"${tag}" 1`)
            .join(", ");
        return features || "normal";
    };

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={24}>
            <GtkLabel label="OpenType Font Features" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="OpenType fonts can include many optional features that change how text is rendered. This demo shows common font features. Note: Feature availability depends on the font being used."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkFrame label="Preview">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={16}
                    marginTop={16}
                    marginBottom={16}
                    marginStart={16}
                    marginEnd={16}
                >
                    <GtkLabel
                        label={`Enabled features: ${Array.from(enabledFeatures).join(", ") || "none"}`}
                        cssClasses={["dim-label", "monospace"]}
                        halign={Gtk.Align.START}
                    />

                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                        <GtkLabel label="Ligatures Sample" cssClasses={["heading"]} halign={Gtk.Align.START} />
                        <GtkLabel label={sampleTexts.ligatures} cssClasses={["title-1"]} halign={Gtk.Align.START} />
                    </GtkBox>

                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                        <GtkLabel label="Figures Sample" cssClasses={["heading"]} halign={Gtk.Align.START} />
                        <GtkLabel label={sampleTexts.figures} cssClasses={["title-1"]} halign={Gtk.Align.START} />
                    </GtkBox>

                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                        <GtkLabel label="Fractions & Ordinals" cssClasses={["heading"]} halign={Gtk.Align.START} />
                        <GtkLabel
                            label={`${sampleTexts.fractions} | ${sampleTexts.ordinals}`}
                            cssClasses={["title-1"]}
                            halign={Gtk.Align.START}
                        />
                    </GtkBox>

                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                        <GtkLabel label="Mixed Sample" cssClasses={["heading"]} halign={Gtk.Align.START} />
                        <GtkLabel label={sampleTexts.mixed} cssClasses={["title-1"]} halign={Gtk.Align.START} />
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Available Features">
                <GtkScrolledWindow heightRequest={300} hscrollbarPolicy={Gtk.PolicyType.NEVER}>
                    <GtkBox
                        orientation={Gtk.Orientation.VERTICAL}
                        spacing={8}
                        marginTop={12}
                        marginBottom={12}
                        marginStart={12}
                        marginEnd={12}
                    >
                        {fontFeatures.map((feature) => (
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
                </GtkScrolledWindow>
            </GtkFrame>

            <GtkFrame label="CSS Usage">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={8}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel label="In CSS, use the font-feature-settings property:" halign={Gtk.Align.START} />
                    <GtkLabel
                        label={`font-feature-settings: ${getFontFeaturesString()};`}
                        cssClasses={["monospace", "card"]}
                        halign={Gtk.Align.START}
                        marginTop={8}
                        marginBottom={8}
                        marginStart={12}
                        marginEnd={12}
                    />
                    <GtkLabel
                        label="Note: GTK uses Pango for text rendering, which supports OpenType features through CSS or Pango attributes."
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />
                </GtkBox>
            </GtkFrame>
        </GtkBox>
    );
};

export const fontFeaturesDemo: Demo = {
    id: "font-features",
    title: "Font Features",
    description: "OpenType font features demonstration",
    keywords: ["font", "opentype", "typography", "ligatures", "small caps", "figures", "pango"],
    component: FontFeaturesDemo,
    sourceCode,
};
