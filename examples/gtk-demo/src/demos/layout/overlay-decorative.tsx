import * as Gdk from "@gtkx/ffi/gdk";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkOverlay, GtkPicture, GtkScale, GtkScrolledWindow, GtkTextView, x } from "@gtkx/react";
import { useMemo, useState } from "react";
import type { Demo } from "../types.js";
import decor1Path from "./decor1.png";
import decor2Path from "./decor2.png";
import sourceCode from "./overlay-decorative.tsx?raw";

const OverlayDecorativeDemo = () => {
    const [margin, setMargin] = useState(100);

    const decor1 = useMemo(() => Gdk.Texture.newFromFilename(decor1Path), []);
    const decor2 = useMemo(() => Gdk.Texture.newFromFilename(decor2Path), []);

    return (
        <GtkOverlay>
            <GtkScrolledWindow hscrollbarPolicy={Gtk.PolicyType.AUTOMATIC} vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}>
                <GtkTextView hexpand vexpand leftMargin={Math.round(margin)}>
                    <x.TextTag id="top-margin" pixelsAboveLines={Math.round(margin)}>
                        {"Dear"}
                    </x.TextTag>
                    {" diary..."}
                </GtkTextView>
            </GtkScrolledWindow>
            <x.OverlayChild>
                <GtkPicture paintable={decor1} halign={Gtk.Align.START} valign={Gtk.Align.START} canTarget={false} />
            </x.OverlayChild>
            <x.OverlayChild>
                <GtkPicture paintable={decor2} halign={Gtk.Align.END} valign={Gtk.Align.END} canTarget={false} />
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
                    value={margin}
                    lower={0}
                    upper={100}
                    stepIncrement={1}
                    pageIncrement={1}
                    onValueChanged={setMargin}
                />
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
    defaultWidth: 500,
    defaultHeight: 510,
};
