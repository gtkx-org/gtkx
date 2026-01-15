import * as Gdk from "@gtkx/ffi/gdk";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkLabel, GtkPaned, GtkScrolledWindow, GtkTextView, x } from "@gtkx/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./css-shadows.tsx?raw";

const DEFAULT_CSS = `/* Edit this CSS to see shadow changes in real-time */
.button1 {
  box-shadow: 0 1px 2px 1px alpha(@theme_fg_color, 0.1);
}

.button1:hover {
  box-shadow: 0 2px 5px 2px alpha(@theme_fg_color, 0.2);
}

.button1:active {
  box-shadow: none;
}

.button2 {
  box-shadow: 0 0 10px 5px alpha(@accent_bg_color, 0.5);
}

.button2:hover {
  box-shadow: 0 0 15px 8px alpha(@accent_bg_color, 0.7);
}

.button2:active {
  box-shadow: none;
}`;

const CssShadowsDemo = () => {
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

    const handleReset = useCallback(() => {
        setCssText(DEFAULT_CSS);
    }, []);

    return (
        <GtkPaned orientation={Gtk.Orientation.VERTICAL} shrinkStartChild={false} shrinkEndChild={false} vexpand hexpand>
            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8} marginTop={8} marginStart={8} marginEnd={8} marginBottom={8}>
                <GtkLabel label="CSS Shadows" cssClasses={["title-3"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="Edit the CSS below to experiment with box-shadow effects. Changes are applied in real-time to the buttons."
                    wrap
                    halign={Gtk.Align.START}
                    cssClasses={["dim-label"]}
                />

                <GtkBox spacing={16} halign={Gtk.Align.CENTER} marginTop={16} marginBottom={16}>
                    <GtkButton label="Prev" cssClasses={["button1"]} />
                    <GtkButton label="Hello World" cssClasses={["button1", "button2"]} />
                    <GtkButton label="Next" cssClasses={["button1"]} />
                </GtkBox>

                <GtkBox spacing={8}>
                    <GtkButton label="Reset CSS" onClicked={handleReset} />
                    {hasError && <GtkLabel label="CSS has errors" cssClasses={["error"]} />}
                </GtkBox>
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

export const cssShadowsDemo: Demo = {
    id: "css-shadows",
    title: "Theming/Shadows",
    description: "Live CSS editing for box-shadow effects. Edit the CSS to experiment with shadows on buttons in real-time.",
    keywords: ["css", "shadow", "box-shadow", "elevation", "depth", "glow", "live", "editing"],
    component: CssShadowsDemo,
    sourceCode,
};
