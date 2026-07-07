import { Overlay } from "@gtkx/components";
import * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";
import {
    GtkAdjustment,
    GtkPicture,
    GtkScale,
    GtkScrolledWindow,
    GtkTextBuffer,
    GtkTextTag,
    GtkTextView,
} from "@gtkx/jsx/gtk";
import { type ReactNode, type RefCallback, useState } from "react";
import { path as decor1Path } from "#data/demos/layout/decor1.png";
import { path as decor2Path } from "#data/demos/layout/decor2.png";
import type { Demo } from "../types.js";
import sourceCode from "./overlay-decorative.tsx?raw";

type DecorPictureOptions = {
    ref: RefCallback<Gtk.Widget>;
    name: string;
    paintable: Gdk.Texture;
    align: Gtk.Align;
};

const decorPicture = ({ ref, name, paintable, align }: DecorPictureOptions): ReactNode => (
    <GtkPicture ref={ref} name={name} paintable={paintable} halign={align} valign={align} canTarget={false} />
);

const OverlayDecorativeDemo = () => {
    const [margin, setMargin] = useState(100);

    const decor1 = Gdk.Texture.newFromResource(decor1Path);
    const decor2 = Gdk.Texture.newFromResource(decor2Path);

    return (
        <Overlay name="overlay">
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
                    buffer={
                        <GtkTextBuffer>
                            <GtkTextTag name="top-margin" pixelsAboveLines={Math.round(margin)}>
                                {"Dear"}
                            </GtkTextTag>
                            {" diary..."}
                        </GtkTextBuffer>
                    }
                />
            </GtkScrolledWindow>
            <Overlay.Child>
                {(ref) => decorPicture({ ref, name: "picture-start", paintable: decor1, align: Gtk.Align.START })}
            </Overlay.Child>
            <Overlay.Child>
                {(ref) => decorPicture({ ref, name: "picture-end", paintable: decor2, align: Gtk.Align.END })}
            </Overlay.Child>
            <Overlay.Child>
                {(ref) => (
                    <GtkScale
                        ref={ref}
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
                        adjustment={
                            <GtkAdjustment value={margin} lower={0} upper={100} stepIncrement={1} pageIncrement={1} />
                        }
                        onValueChanged={(scale) => setMargin(scale.getValue())}
                    />
                )}
            </Overlay.Child>
        </Overlay>
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
