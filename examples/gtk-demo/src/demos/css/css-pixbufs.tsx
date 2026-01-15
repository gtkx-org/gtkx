import { injectGlobal } from "@gtkx/css";
import * as Gdk from "@gtkx/ffi/gdk";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkLabel, GtkPaned, GtkScrolledWindow, GtkTextView, x } from "@gtkx/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./css-pixbufs.tsx?raw";

injectGlobal`
@keyframes gradient-shift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

@keyframes rotate-hue {
  0% { filter: hue-rotate(0deg); }
  100% { filter: hue-rotate(360deg); }
}

@keyframes pulse-scale {
  0%, 100% { -gtk-icon-transform: scale(1); }
  50% { -gtk-icon-transform: scale(1.1); }
}

@keyframes float {
  0%, 100% { margin-top: 0px; }
  50% { margin-top: -10px; }
}
`;

const PRESETS: Record<string, string> = {
    "Gradient Shift": `/* Animated gradient background */
.animated-bg {
  background: linear-gradient(
    270deg,
    #ff6b6b,
    #feca57,
    #48dbfb,
    #ff9ff3,
    #54a0ff
  );
  background-size: 400% 400%;
  animation: gradient-shift 8s ease infinite;
  min-height: 200px;
  border-radius: 12px;
}`,
    "Hue Rotation": `/* Rotating hue filter on gradient */
.animated-bg {
  background: linear-gradient(
    135deg,
    #667eea 0%,
    #764ba2 50%,
    #f093fb 100%
  );
  animation: rotate-hue 5s linear infinite;
  min-height: 200px;
  border-radius: 12px;
}`,
    "Pulsing Icon": `/* Icon with scale animation */
.animated-bg {
  background-image: -gtk-icontheme("starred-symbolic");
  background-size: 64px 64px;
  background-repeat: no-repeat;
  background-position: center;
  background-color: alpha(@accent_bg_color, 0.1);
  animation: pulse-scale 1.5s ease-in-out infinite;
  min-height: 200px;
  border-radius: 12px;
}`,
    "Floating Icons": `/* Tiled icons with floating animation */
.animated-bg {
  background-image: -gtk-icontheme("emblem-favorite-symbolic");
  background-size: 32px 32px;
  background-repeat: repeat;
  background-color: @theme_bg_color;
  animation: float 2s ease-in-out infinite;
  min-height: 200px;
  border-radius: 12px;
  opacity: 0.6;
}`,
    "Rainbow Waves": `/* Multiple animated gradients */
.animated-bg {
  background:
    linear-gradient(45deg, transparent 45%, rgba(255,0,0,0.2) 50%, transparent 55%),
    linear-gradient(135deg, transparent 45%, rgba(0,255,0,0.2) 50%, transparent 55%),
    linear-gradient(225deg, transparent 45%, rgba(0,0,255,0.2) 50%, transparent 55%),
    linear-gradient(315deg, transparent 45%, rgba(255,255,0,0.2) 50%, transparent 55%),
    @theme_bg_color;
  background-size: 200% 200%;
  animation: gradient-shift 4s linear infinite;
  min-height: 200px;
  border-radius: 12px;
}`,
    "Morphing Gradient": `/* Smooth color morphing */
.animated-bg {
  background: linear-gradient(
    90deg,
    #12c2e9,
    #c471ed,
    #f64f59
  );
  background-size: 200% 100%;
  animation: gradient-shift 6s ease infinite;
  min-height: 200px;
  border-radius: 12px;
}`,
};

const DEFAULT_CSS = PRESETS["Gradient Shift"] ?? "";

const CssPixbufsDemo = () => {
    const textViewRef = useRef<Gtk.TextView | null>(null);
    const providerRef = useRef<Gtk.CssProvider | null>(null);
    const [cssText, setCssText] = useState(DEFAULT_CSS);
    const [hasError, setHasError] = useState(false);

    const applyCss = useCallback(() => {
        const display = Gdk.Display.getDefault();
        if (!display) return;

        if (providerRef.current) {
            Gtk.StyleContext.removeProviderForDisplay(display, providerRef.current);
        }

        const provider = new Gtk.CssProvider();
        providerRef.current = provider;

        try {
            provider.loadFromString(cssText);
            setHasError(false);
        } catch {
            setHasError(true);
        }

        Gtk.StyleContext.addProviderForDisplay(display, provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
    }, [cssText]);

    useEffect(() => {
        applyCss();
        return () => {
            const display = Gdk.Display.getDefault();
            if (display && providerRef.current) {
                Gtk.StyleContext.removeProviderForDisplay(display, providerRef.current);
            }
        };
    }, [applyCss]);

    const handleTextChanged = useCallback((text: string) => {
        setCssText(text);
    }, []);

    const handlePreset = useCallback((presetName: string) => {
        const preset = PRESETS[presetName];
        if (preset) {
            setCssText(preset);
        }
    }, []);

    return (
        <GtkPaned orientation={Gtk.Orientation.VERTICAL} shrinkStartChild={false} shrinkEndChild={false} vexpand hexpand>
            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12} marginTop={12} marginStart={12} marginEnd={12} marginBottom={12}>
                <GtkLabel label="Animated Backgrounds" cssClasses={["title-3"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="GTK CSS supports @keyframes animations for continuous motion effects. Animate gradients, icons, filters, and transforms. Edit the CSS below to experiment."
                    wrap
                    halign={Gtk.Align.START}
                    cssClasses={["dim-label"]}
                />

                <GtkBox cssClasses={["animated-bg"]} hexpand vexpand>
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8} halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER} hexpand vexpand>
                        <GtkLabel label="Live Preview" cssClasses={["title-3"]} />
                        <GtkLabel label="Watch the animation" cssClasses={["dim-label"]} />
                    </GtkBox>
                </GtkBox>

                <GtkBox spacing={4} halign={Gtk.Align.CENTER}>
                    {Object.keys(PRESETS).map((name) => (
                        <GtkButton
                            key={name}
                            label={name}
                            cssClasses={["flat"]}
                            onClicked={() => handlePreset(name)}
                        />
                    ))}
                </GtkBox>

                {hasError && <GtkLabel label="CSS has errors" cssClasses={["error"]} halign={Gtk.Align.START} />}
            </GtkBox>

            <GtkScrolledWindow vexpand hexpand>
                <GtkTextView
                    ref={textViewRef}
                    monospace
                    wrapMode={Gtk.WrapMode.WORD_CHAR}
                    topMargin={8}
                    bottomMargin={8}
                    leftMargin={8}
                    rightMargin={8}
                >
                    <x.TextBuffer onTextChanged={handleTextChanged}>{cssText}</x.TextBuffer>
                </GtkTextView>
            </GtkScrolledWindow>
        </GtkPaned>
    );
};

export const cssPixbufsDemo: Demo = {
    id: "css-pixbufs",
    title: "Theming/Animated Backgrounds",
    description: "CSS @keyframes animations for gradient shifts, hue rotation, icon pulsing, and more. Edit CSS to experiment with animations.",
    keywords: ["css", "animation", "keyframes", "gradient", "icon", "pixbuf", "background", "live", "editing"],
    component: CssPixbufsDemo,
    sourceCode,
};
