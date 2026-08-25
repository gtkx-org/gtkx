import * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";
import {
    GtkAdjustment,
    GtkOverlay,
    GtkOverlayLayoutChild,
    GtkPicture,
    GtkScale,
    GtkScrolledWindow,
    GtkTextBuffer,
    GtkTextTag,
    GtkTextView,
} from "@gtkx/jsx/gtk";
import { type ReactNode, useState } from "react";
import type { Demo } from "../types.js";
import decor1Path from "../../../data/demos/layout/decor1.png?resource";
import decor2Path from "../../../data/demos/layout/decor2.png?resource";
import sourceCode from "./overlay-decorative.tsx?raw";

type DecorPictureOptions = {
    name: string;
    paintable: Gdk.Texture;
    align: Gtk.Align;
};

const overlayDecorativeDemo: Demo = {
    id: "overlay-decorative",
    title: "Overlay/Decorative Overlay",
    description: "Another example of an overlay with some decorative and some interactive controls.",
    keywords: ["GtkOverlay"],
    component: OverlayDecorativeDemo,
    sourceCode,
    defaultWidth: 500,
    defaultHeight: 510,
};

const decorPicture = ({ name, paintable, align }: DecorPictureOptions): ReactNode => (
    <GtkOverlayLayoutChild key={name}>
        <GtkPicture name={name} paintable={paintable} halign={align} valign={align} canTarget={false} />
    </GtkOverlayLayoutChild>
);

const marginScale = (margin: number, onMarginChanged: (scale: Gtk.Scale) => void): ReactNode => (
    <GtkOverlayLayoutChild key="overlay-0">
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
            adjustment={<GtkAdjustment value={margin} lower={0} upper={100} stepIncrement={1} pageIncrement={1} />}
            onValueChanged={onMarginChanged}
        />
    </GtkOverlayLayoutChild>
);

function OverlayDecorativeDemo() {
    const [margin, setMargin] = useState(100);
    const decor1 = Gdk.Texture.newFromResource(decor1Path);
    const decor2 = Gdk.Texture.newFromResource(decor2Path);

    const handleMarginChanged = (scale: Gtk.Scale) => {
        setMargin(scale.getValue());
    };

    return (
        <GtkOverlay
            name="overlay"
            overlays={[
                marginScale(margin, handleMarginChanged),
                decorPicture({ name: "picture-start", paintable: decor1, align: Gtk.Align.START }),
                decorPicture({ name: "picture-end", paintable: decor2, align: Gtk.Align.END }),
            ]}
        >
            <GtkScrolledWindow
                name="scrolled"
                hscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
                vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
            >
                <GtkTextView
                    name="text-view"
                    hexpand
                    vexpand
                    leftMargin={Math.round(margin)}
                    buffer={(
                        <GtkTextBuffer>
                            <GtkTextTag name="top-margin" pixelsAboveLines={Math.round(margin)}>
                                Dear
                            </GtkTextTag>
                            {" diary..."}
                        </GtkTextBuffer>
                    )}
                />
            </GtkScrolledWindow>
        </GtkOverlay>
    );
}

export { overlayDecorativeDemo };
