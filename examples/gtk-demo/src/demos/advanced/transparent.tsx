import { injectGlobal } from "@gtkx/css";
import * as Gdk from "@gtkx/ffi/gdk";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkOverlay, GtkPicture, x } from "@gtkx/react";
import { useMemo } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./transparent.tsx?raw";

injectGlobal`
.floating-controls {
    margin: 10px;
    border-spacing: 10px;
}

.blur-overlay {
    background: none;
    background-color: rgba(0, 0, 0, 0.3);
    color: white;
    transition-property: background-color, color;
    transition-duration: 0.3s;
}

.blur-overlay:hover {
    background: none;
    background-color: rgba(200, 200, 200, 0.9);
    color: black;
}
`;

const TransparentDemo = () => {
    const texture = useMemo(() => {
        const file = Gdk.Texture.newFromFilename(new URL("./portland-rose.jpg", import.meta.url).pathname);
        return file;
    }, []);

    return (
        <GtkOverlay>
            <GtkPicture paintable={texture} contentFit={Gtk.ContentFit.COVER} canShrink />
            <x.OverlayChild>
                <GtkBox cssClasses={["floating-controls"]} halign={Gtk.Align.FILL} valign={Gtk.Align.END} homogeneous>
                    <GtkButton label="Don't click this button!" cssClasses={["blur-overlay"]} hexpand />
                    <GtkButton label="Maybe this one?" cssClasses={["blur-overlay"]} hexpand />
                </GtkBox>
            </x.OverlayChild>
        </GtkOverlay>
    );
};

export const transparentDemo: Demo = {
    id: "transparent",
    title: "Transparency",
    description: "Semi-transparent overlay controls",
    keywords: ["GtkOverlay", "transparency"],
    component: TransparentDemo,
    sourceCode,
};
