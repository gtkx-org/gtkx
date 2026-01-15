import * as Gtk from "@gtkx/ffi/gtk";
import { GtkImage, GtkOverlay, GtkScale, GtkScrolledWindow, GtkTextView, x } from "@gtkx/react";
import { useCallback, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./overlay-decorative.tsx?raw";

const INITIAL_TEXT = "Dear diary...";

/**
 * Overlay/Decorative Overlay demo matching the official GTK gtk-demo.
 * Another example of an overlay with some decorative and some interactive controls.
 */
const OverlayDecorativeDemo = () => {
    const [margin, setMargin] = useState(100);
    const textViewRef = useRef<Gtk.TextView | null>(null);

    const handleMarginChanged = useCallback((value: number) => {
        setMargin(value);
        if (textViewRef.current) {
            textViewRef.current.setLeftMargin(Math.round(value));
        }
    }, []);

    const handleTextViewRef = useCallback((textView: Gtk.TextView | null) => {
        textViewRef.current = textView;
        if (textView) {
            const buffer = textView.getBuffer();
            buffer.setText(INITIAL_TEXT, -1);
            textView.setLeftMargin(Math.round(margin));
        }
    }, [margin]);

    return (
        <GtkOverlay>
            <GtkScrolledWindow hscrollbarPolicy={Gtk.PolicyType.AUTOMATIC} vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}>
                <GtkTextView ref={handleTextViewRef} hexpand vexpand />
            </GtkScrolledWindow>
            <x.OverlayChild>
                <GtkImage
                    iconName="starred-symbolic"
                    pixelSize={64}
                    halign={Gtk.Align.START}
                    valign={Gtk.Align.START}
                    canTarget={false}
                    opacity={0.3}
                    marginStart={8}
                    marginTop={8}
                />
            </x.OverlayChild>
            <x.OverlayChild>
                <GtkImage
                    iconName="starred-symbolic"
                    pixelSize={64}
                    halign={Gtk.Align.END}
                    valign={Gtk.Align.END}
                    canTarget={false}
                    opacity={0.3}
                    marginEnd={8}
                    marginBottom={8}
                />
            </x.OverlayChild>
            <x.OverlayChild>
                <GtkScale
                    orientation={Gtk.Orientation.HORIZONTAL}
                    drawValue={false}
                    widthRequest={120}
                    halign={Gtk.Align.START}
                    valign={Gtk.Align.END}
                    marginStart={20}
                    marginEnd={20}
                    marginBottom={20}
                    tooltipText="Margin"
                >
                    <x.Adjustment
                        value={margin}
                        lower={0}
                        upper={100}
                        stepIncrement={1}
                        pageIncrement={1}
                        onValueChanged={handleMarginChanged}
                    />
                </GtkScale>
            </x.OverlayChild>
        </GtkOverlay>
    );
};

export const overlayDecorativeDemo: Demo = {
    id: "overlay-decorative",
    title: "Overlay/Decorative Overlay",
    description: "Another example of an overlay with some decorative and some interactive controls.",
    keywords: ["overlay", "badge", "ribbon", "watermark", "notification", "decorative", "layer", "GtkOverlay"],
    component: OverlayDecorativeDemo,
    sourceCode,
};
