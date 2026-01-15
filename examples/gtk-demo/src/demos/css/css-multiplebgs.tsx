import * as Gdk from "@gtkx/ffi/gdk";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkLabel, GtkPaned, GtkScrolledWindow, GtkTextView, x } from "@gtkx/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./css-multiplebgs.tsx?raw";

const PRESETS: Record<string, string> = {
    "Gradient Stack": `/* Layered linear gradients from corners */
.multi-bg-demo {
  background:
    linear-gradient(135deg, rgba(255,0,0,0.3) 0%, transparent 50%),
    linear-gradient(225deg, rgba(0,255,0,0.3) 0%, transparent 50%),
    linear-gradient(315deg, rgba(0,0,255,0.3) 0%, transparent 50%),
    linear-gradient(45deg, rgba(255,255,0,0.3) 0%, transparent 50%),
    @theme_bg_color;
  min-height: 200px;
  border-radius: 12px;
}`,
    "Radial Layers": `/* Overlapping radial gradients */
.multi-bg-demo {
  background:
    radial-gradient(circle at 20% 30%, rgba(255,0,128,0.5) 0%, transparent 35%),
    radial-gradient(circle at 80% 70%, rgba(0,200,255,0.5) 0%, transparent 35%),
    radial-gradient(circle at 50% 50%, rgba(255,200,0,0.4) 0%, transparent 50%),
    @theme_bg_color;
  min-height: 200px;
  border-radius: 12px;
}`,
    "Striped Pattern": `/* Repeating diagonal stripes */
.multi-bg-demo {
  background:
    repeating-linear-gradient(
      45deg,
      transparent,
      transparent 10px,
      rgba(0,0,0,0.08) 10px,
      rgba(0,0,0,0.08) 20px
    ),
    repeating-linear-gradient(
      -45deg,
      transparent,
      transparent 10px,
      rgba(0,0,0,0.08) 10px,
      rgba(0,0,0,0.08) 20px
    ),
    linear-gradient(180deg, @accent_bg_color, shade(@accent_bg_color, 0.8));
  min-height: 200px;
  border-radius: 12px;
}`,
    "Spotlight": `/* Top spotlight effect */
.multi-bg-demo {
  background:
    radial-gradient(ellipse 80% 50% at 50% 0%, rgba(255,255,255,0.4) 0%, transparent 70%),
    linear-gradient(180deg, shade(@accent_bg_color, 1.3), shade(@accent_bg_color, 0.6));
  min-height: 200px;
  border-radius: 12px;
}`,
    "Mesh Gradient": `/* Multi-point mesh gradient */
.multi-bg-demo {
  background:
    radial-gradient(at 0% 0%, #ff6b6b 0%, transparent 50%),
    radial-gradient(at 100% 0%, #4ecdc4 0%, transparent 50%),
    radial-gradient(at 100% 100%, #45b7d1 0%, transparent 50%),
    radial-gradient(at 0% 100%, #96ceb4 0%, transparent 50%),
    #2c3e50;
  min-height: 200px;
  border-radius: 12px;
}`,
};

const DEFAULT_CSS = PRESETS["Gradient Stack"] ?? "";

const CssMultiplebgsDemo = () => {
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
                <GtkLabel label="Multiple Backgrounds" cssClasses={["title-3"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="CSS allows stacking multiple background layers. Each layer can be a gradient, image, or color. The first layer appears on top. Edit the CSS below to experiment."
                    wrap
                    halign={Gtk.Align.START}
                    cssClasses={["dim-label"]}
                />

                <GtkBox cssClasses={["multi-bg-demo"]} hexpand vexpand>
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8} halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER} hexpand vexpand>
                        <GtkLabel label="Live Preview" cssClasses={["title-3"]} />
                        <GtkLabel label="Edit CSS below to see changes" cssClasses={["dim-label"]} />
                    </GtkBox>
                </GtkBox>

                <GtkBox spacing={8} halign={Gtk.Align.CENTER}>
                    <GtkLabel label="Presets:" cssClasses={["dim-label"]} />
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

export const cssMultiplebgsDemo: Demo = {
    id: "css-multiplebgs",
    title: "Theming/Multiple Backgrounds",
    description: "Stack multiple CSS background layers with live editing. Experiment with linear, radial, and repeating gradients.",
    keywords: ["css", "background", "gradient", "layers", "multiple", "radial", "linear", "live", "editing"],
    component: CssMultiplebgsDemo,
    sourceCode,
};
