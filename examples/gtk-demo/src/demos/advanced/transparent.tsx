import { css, injectGlobal } from "@gtkx/css";
import { type Context, Pattern } from "@gtkx/ffi/cairo";
import * as Gdk from "@gtkx/ffi/gdk";
import * as Gtk from "@gtkx/ffi/gtk";
import {
    GtkBox,
    GtkButton,
    GtkDrawingArea,
    GtkFrame,
    GtkImage,
    GtkLabel,
    GtkOverlay,
    GtkScale,
    GtkToggleButton,
    x,
} from "@gtkx/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./transparent.tsx?raw";

injectGlobal`
.glass-card {
    background-color: alpha(@card_bg_color, 0.7);
    border-radius: 12px;
    border: 1px solid alpha(white, 0.2);
}

.glass-dark {
    background-color: alpha(black, 0.4);
    color: white;
}

.gradient-overlay {
    background: linear-gradient(180deg, alpha(@accent_bg_color, 0.3), alpha(@accent_bg_color, 0.1));
}
`;

const transparencyInfoStyle = css`
 background-color: alpha(@accent_bg_color, 0.1);
 border-radius: 8px;
 padding: 12px;
`;

const floatingCardStyle = css`
 background-color: alpha(@card_bg_color, 0.85);
 border-radius: 16px;
 padding: 16px;
 margin: 12px;
`;

const drawCheckeredBackground = (_self: Gtk.DrawingArea, cr: Context, width: number, height: number) => {
    const checkSize = 12;
    for (let y = 0; y < height; y += checkSize) {
        for (let x = 0; x < width; x += checkSize) {
            const isLight = (x / checkSize + y / checkSize) % 2 === 0;
            cr.setSourceRgb(isLight ? 0.85 : 0.65, isLight ? 0.85 : 0.65, isLight ? 0.85 : 0.65)
                .rectangle(x, y, checkSize, checkSize)
                .fill();
        }
    }
};

const drawTransparencyDemo = (alpha: number, gradientType: "solid" | "linear" | "radial") => {
    return (_self: Gtk.DrawingArea, cr: Context, width: number, height: number) => {
        const checkSize = 10;
        for (let y = 0; y < height; y += checkSize) {
            for (let x = 0; x < width; x += checkSize) {
                const isLight = (x / checkSize + y / checkSize) % 2 === 0;
                cr.setSourceRgb(isLight ? 0.9 : 0.7, isLight ? 0.9 : 0.7, isLight ? 0.9 : 0.7)
                    .rectangle(x, y, checkSize, checkSize)
                    .fill();
            }
        }

        if (gradientType === "solid") {
            cr.setSourceRgba(0.2, 0.4, 0.8, alpha)
                .rectangle(20, 20, width - 40, height - 40)
                .fill();
        } else if (gradientType === "linear") {
            const gradient = Pattern.createLinear(0, 0, width, height);
            gradient.addColorStopRgba(0, 0.8, 0.2, 0.2, alpha);
            gradient.addColorStopRgba(0.5, 0.2, 0.8, 0.2, alpha);
            gradient.addColorStopRgba(1, 0.2, 0.2, 0.8, alpha);
            cr.setSource(gradient)
                .rectangle(20, 20, width - 40, height - 40)
                .fill();
        } else {
            const centerX = width / 2;
            const centerY = height / 2;
            const radius = Math.min(width, height) / 2 - 20;
            const gradient = Pattern.createRadial(centerX, centerY, 0, centerX, centerY, radius);
            gradient.addColorStopRgba(0, 1, 1, 0.2, alpha);
            gradient.addColorStopRgba(0.5, 0.8, 0.4, 0.2, alpha);
            gradient.addColorStopRgba(1, 0.2, 0.2, 0.8, alpha * 0.5);
            cr.setSource(gradient)
                .arc(centerX, centerY, radius, 0, 2 * Math.PI)
                .fill();
        }

        cr.setSourceRgba(0, 0, 0, 0.8)
            .moveTo(30, height - 30)
            .setFontSize(14)
            .showText(`Alpha: ${alpha.toFixed(2)}`);
    };
};

const drawOverlappingShapes = (_self: Gtk.DrawingArea, cr: Context, width: number, height: number) => {
    cr.setSourceRgb(1, 1, 1).rectangle(0, 0, width, height).fill();

    const centerX = width / 2;
    const centerY = height / 2;
    const radius = 50;
    const offset = 35;

    cr.setSourceRgba(0.9, 0.1, 0.1, 0.6)
        .arc(centerX, centerY - offset, radius, 0, 2 * Math.PI)
        .fill();

    cr.setSourceRgba(0.1, 0.9, 0.1, 0.6)
        .arc(centerX - offset, centerY + offset * 0.5, radius, 0, 2 * Math.PI)
        .fill();

    cr.setSourceRgba(0.1, 0.1, 0.9, 0.6)
        .arc(centerX + offset, centerY + offset * 0.5, radius, 0, 2 * Math.PI)
        .fill();
};

const OverlayDemo = () => {
    const [overlayOpacity, setOverlayOpacity] = useState(0.7);
    const [showOverlay, setShowOverlay] = useState(true);
    const providerRef = useRef<Gtk.CssProvider | null>(null);

    useEffect(() => {
        const display = Gdk.Display.getDefault();
        if (!display) return;

        if (providerRef.current) {
            Gtk.StyleContext.removeProviderForDisplay(display, providerRef.current);
        }

        const provider = new Gtk.CssProvider();
        providerRef.current = provider;
        provider.loadFromString(`.overlay-card-dynamic { background-color: alpha(@card_bg_color, ${overlayOpacity}); }`);
        Gtk.StyleContext.addProviderForDisplay(display, provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);

        return () => {
            const d = Gdk.Display.getDefault();
            if (d && providerRef.current) {
                Gtk.StyleContext.removeProviderForDisplay(d, providerRef.current);
            }
        };
    }, [overlayOpacity]);

    return (
        <GtkFrame label="GtkOverlay Demo">
            <GtkBox
                orientation={Gtk.Orientation.VERTICAL}
                spacing={12}
                marginStart={12}
                marginEnd={12}
                marginTop={12}
                marginBottom={12}
            >
                <GtkLabel
                    label="GtkOverlay stacks widgets on top of each other. Combined with CSS alpha transparency, you can create floating panels, HUD elements, and glass-morphism effects."
                    wrap
                    halign={Gtk.Align.START}
                    cssClasses={["dim-label"]}
                />

                <GtkOverlay>
                    <GtkDrawingArea onDraw={drawCheckeredBackground} contentWidth={400} contentHeight={200} />
                    {showOverlay && (
                        <x.OverlayChild>
                            <GtkBox
                                cssClasses={["overlay-card-dynamic", "glass-card"]}
                                halign={Gtk.Align.CENTER}
                                valign={Gtk.Align.CENTER}
                                marginStart={20}
                                marginEnd={20}
                                marginTop={20}
                                marginBottom={20}
                            >
                                <GtkBox
                                    orientation={Gtk.Orientation.VERTICAL}
                                    spacing={8}
                                    marginStart={24}
                                    marginEnd={24}
                                    marginTop={16}
                                    marginBottom={16}
                                >
                                    <GtkBox spacing={8} halign={Gtk.Align.CENTER}>
                                        <GtkImage iconName="weather-clear-symbolic" pixelSize={32} />
                                        <GtkLabel label="Glass Card" cssClasses={["title-3"]} />
                                    </GtkBox>
                                    <GtkLabel
                                        label={`Opacity: ${(overlayOpacity * 100).toFixed(0)}%`}
                                        cssClasses={["dim-label"]}
                                    />
                                    <GtkLabel label="This overlay floats above the checkered background" wrap />
                                </GtkBox>
                            </GtkBox>
                        </x.OverlayChild>
                    )}
                    {showOverlay && (
                        <x.OverlayChild>
                            <GtkBox
                                cssClasses={["glass-dark"]}
                                halign={Gtk.Align.END}
                                valign={Gtk.Align.END}
                                marginStart={8}
                                marginEnd={8}
                                marginTop={8}
                                marginBottom={8}
                            >
                                <GtkLabel
                                    label="Corner Badge"
                                    cssClasses={["caption"]}
                                    marginStart={8}
                                    marginEnd={8}
                                    marginTop={4}
                                    marginBottom={4}
                                />
                            </GtkBox>
                        </x.OverlayChild>
                    )}
                </GtkOverlay>

                <GtkBox spacing={12}>
                    <GtkLabel label="Overlay Opacity:" widthRequest={120} halign={Gtk.Align.START} />
                    <GtkScale drawValue digits={0} valuePos={Gtk.PositionType.RIGHT} hexpand>
                        <x.Adjustment
                            value={overlayOpacity * 100}
                            lower={10}
                            upper={100}
                            stepIncrement={5}
                            pageIncrement={10}
                            onValueChanged={(v) => setOverlayOpacity(v / 100)}
                        />
                    </GtkScale>
                </GtkBox>

                <GtkToggleButton
                    label={showOverlay ? "Hide Overlays" : "Show Overlays"}
                    active={showOverlay}
                    onToggled={(btn) => setShowOverlay(btn.getActive())}
                    halign={Gtk.Align.CENTER}
                />
            </GtkBox>
        </GtkFrame>
    );
};

const TransparentDemo = () => {
    const [alpha, setAlpha] = useState(0.5);
    const [gradientType, setGradientType] = useState<"solid" | "linear" | "radial">("solid");

    const drawMain = useCallback(
        (self: Gtk.DrawingArea, cr: Context, width: number, height: number) => {
            drawTransparencyDemo(alpha, gradientType)(self, cr, width, height);
        },
        [alpha, gradientType],
    );

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={20}
            marginStart={20}
            marginEnd={20}
            marginTop={20}
            marginBottom={20}
        >
            <GtkLabel label="Transparency & Overlays" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="GTK4 supports RGBA visuals for transparent widgets. GtkOverlay enables stacking widgets with CSS alpha transparency for glass-morphism and floating panel effects."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <OverlayDemo />

            <GtkFrame label="Cairo Alpha Drawing">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={16}
                    marginStart={16}
                    marginEnd={16}
                    marginTop={16}
                    marginBottom={16}
                >
                    <GtkDrawingArea
                        onDraw={drawMain}
                        contentWidth={300}
                        contentHeight={150}
                        halign={Gtk.Align.CENTER}
                        cssClasses={["card"]}
                    />

                    <GtkBox spacing={12}>
                        <GtkLabel label="Alpha:" widthRequest={60} halign={Gtk.Align.START} />
                        <GtkScale drawValue digits={2} valuePos={Gtk.PositionType.RIGHT} hexpand>
                            <x.Adjustment
                                value={alpha}
                                lower={0}
                                upper={1}
                                stepIncrement={0.05}
                                pageIncrement={0.1}
                                onValueChanged={setAlpha}
                            />
                        </GtkScale>
                    </GtkBox>

                    <GtkBox spacing={8} halign={Gtk.Align.CENTER}>
                        <GtkLabel label="Gradient:" />
                        {(["solid", "linear", "radial"] as const).map((type) => (
                            <GtkButton
                                key={type}
                                label={type.charAt(0).toUpperCase() + type.slice(1)}
                                cssClasses={gradientType === type ? ["suggested-action"] : []}
                                onClicked={() => setGradientType(type)}
                            />
                        ))}
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Color Blending">
                <GtkBox spacing={16} marginStart={16} marginEnd={16} marginTop={16} marginBottom={16}>
                    <GtkDrawingArea
                        onDraw={drawOverlappingShapes}
                        contentWidth={200}
                        contentHeight={180}
                        cssClasses={["card"]}
                    />
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8} valign={Gtk.Align.CENTER}>
                        <GtkLabel
                            label="RGB circles at 60% opacity blend together where they overlap, creating secondary and tertiary colors."
                            wrap
                            widthRequest={200}
                            cssClasses={["dim-label"]}
                        />
                        <GtkLabel label="Red + Green = Yellow" cssClasses={["caption"]} halign={Gtk.Align.START} />
                        <GtkLabel label="Green + Blue = Cyan" cssClasses={["caption"]} halign={Gtk.Align.START} />
                        <GtkLabel label="Red + Blue = Magenta" cssClasses={["caption"]} halign={Gtk.Align.START} />
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="CSS Alpha Functions">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginStart={16}
                    marginEnd={16}
                    marginTop={16}
                    marginBottom={16}
                >
                    <GtkBox cssClasses={[floatingCardStyle]} halign={Gtk.Align.CENTER}>
                        <GtkLabel label="alpha(@card_bg_color, 0.85)" cssClasses={["monospace"]} />
                    </GtkBox>

                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={4} cssClasses={[transparencyInfoStyle]}>
                        <GtkLabel label="alpha(color, opacity) - Set opacity of a color" halign={Gtk.Align.START} />
                        <GtkLabel
                            label="shade(color, factor) - Lighten/darken a color"
                            halign={Gtk.Align.START}
                        />
                        <GtkLabel
                            label="mix(color1, color2, factor) - Blend two colors"
                            halign={Gtk.Align.START}
                        />
                    </GtkBox>
                </GtkBox>
            </GtkFrame>
        </GtkBox>
    );
};

export const transparentDemo: Demo = {
    id: "transparent",
    title: "Overlay/Transparency",
    description: "Transparent overlays, glass-morphism, and RGBA alpha blending with GtkOverlay and CSS",
    keywords: ["transparent", "overlay", "glass", "rgba", "alpha", "opacity", "blur", "cairo", "blending"],
    component: TransparentDemo,
    sourceCode,
};
