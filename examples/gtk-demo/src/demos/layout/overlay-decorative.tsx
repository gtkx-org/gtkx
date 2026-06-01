import * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkOverlay, GtkPicture, GtkScale, GtkScrolledWindow, GtkTextView } from "@gtkx/react";
import { useMemo, useState } from "react";
import type { Demo } from "../types.js";
import { path as decor1Path } from "./decor1.png";
import { path as decor2Path } from "./decor2.png";
import sourceCode from "./overlay-decorative.tsx?raw";

const OverlayDecorativeDemo = () => {
    const [margin, setMargin] = useState(100);

    const decor1 = useMemo(() => Gdk.Texture.newFromResource(decor1Path), []);
    const decor2 = useMemo(() => Gdk.Texture.newFromResource(decor2Path), []);

    return (
        <GtkOverlay name="overlay">
            <GtkScrolledWindow
                name="scrolled"
                hscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
                vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
            >
                <GtkTextView name="text-view" hexpand vexpand leftMargin={Math.round(margin)}>
                    <GtkTextView.Tag id="top-margin" pixelsAboveLines={Math.round(margin)}>
                        {"Dear"}
                    </GtkTextView.Tag>
                    {" diary..."}
                </GtkTextView>
            </GtkScrolledWindow>
            <GtkOverlay.Child>
                <GtkPicture
                    name="picture-start"
                    paintable={decor1}
                    halign={Gtk.Align.START}
                    valign={Gtk.Align.START}
                    canTarget={false}
                />
            </GtkOverlay.Child>
            <GtkOverlay.Child>
                <GtkPicture
                    name="picture-end"
                    paintable={decor2}
                    halign={Gtk.Align.END}
                    valign={Gtk.Align.END}
                    canTarget={false}
                />
            </GtkOverlay.Child>
            <GtkOverlay.Child>
                <GtkScale
                    name="margin-scale"
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
            </GtkOverlay.Child>
        </GtkOverlay>
    );
};

export const overlayDecorativeDemo: Demo = {
    id: "overlay-decorative",
    title: "Overlay/Decorative Overlay",
    description: "Another example of an overlay with some decorative and some interactive controls.",
    keywords: ["GtkOverlay"],
    component: OverlayDecorativeDemo,
    sourceCode,
    defaultWidth: 500,
    defaultHeight: 510,
};
