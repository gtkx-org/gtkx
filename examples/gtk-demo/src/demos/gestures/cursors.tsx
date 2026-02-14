import { css } from "@gtkx/css";
import * as Gdk from "@gtkx/ffi/gdk";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkFrame, GtkLabel, GtkListBox, GtkListBoxRow, GtkPicture, GtkScrolledWindow } from "@gtkx/react";
import { useMemo } from "react";
import type { Demo } from "../types.js";
import aliasPath from "./cursors/alias_cursor.png";
import allScrollPath from "./cursors/all_scroll_cursor.png";
import cellPath from "./cursors/cell_cursor.png";
import colResizePath from "./cursors/col_resize_cursor.png";
import contextMenuPath from "./cursors/context_menu_cursor.png";
import copyPath from "./cursors/copy_cursor.png";
import crosshairPath from "./cursors/crosshair_cursor.png";
import defaultPath from "./cursors/default_cursor.png";
import eResizePath from "./cursors/e_resize_cursor.png";
import ewResizePath from "./cursors/ew_resize_cursor.png";
import grabPath from "./cursors/grab_cursor.png";
import grabbingPath from "./cursors/grabbing_cursor.png";
import gtkLogoPath from "./cursors/gtk_logo_cursor.png";
import helpPath from "./cursors/help_cursor.png";
import movePath from "./cursors/move_cursor.png";
import nResizePath from "./cursors/n_resize_cursor.png";
import neResizePath from "./cursors/ne_resize_cursor.png";
import neswResizePath from "./cursors/nesw_resize_cursor.png";
import noDropPath from "./cursors/no_drop_cursor.png";
import nonePath from "./cursors/none_cursor.png";
import notAllowedPath from "./cursors/not_allowed_cursor.png";
import nsResizePath from "./cursors/ns_resize_cursor.png";
import nwResizePath from "./cursors/nw_resize_cursor.png";
import nwseResizePath from "./cursors/nwse_resize_cursor.png";
import pointerPath from "./cursors/pointer_cursor.png";
import progressPath from "./cursors/progress_cursor.png";
import rowResizePath from "./cursors/row_resize_cursor.png";
import sResizePath from "./cursors/s_resize_cursor.png";
import seResizePath from "./cursors/se_resize_cursor.png";
import swResizePath from "./cursors/sw_resize_cursor.png";
import textPath from "./cursors/text_cursor.png";
import verticalTextPath from "./cursors/vertical_text_cursor.png";
import wResizePath from "./cursors/w_resize_cursor.png";
import waitPath from "./cursors/wait_cursor.png";
import zoomInPath from "./cursors/zoom_in_cursor.png";
import zoomOutPath from "./cursors/zoom_out_cursor.png";
import sourceCode from "./cursors.tsx?raw";

const cursorbgStyle = css`
    background: linear-gradient(135deg, white 50%, black 50%);
`;

interface CursorInfo {
    name: string;
    image: string;
    hotX: number;
    hotY: number;
}

const CURSORS: CursorInfo[] = [
    { name: "default", image: defaultPath, hotX: 5, hotY: 5 },
    { name: "none", image: nonePath, hotX: 0, hotY: 0 },
    { name: "gtk-logo", image: gtkLogoPath, hotX: 18, hotY: 2 },
    { name: "context-menu", image: contextMenuPath, hotX: 5, hotY: 5 },
    { name: "help", image: helpPath, hotX: 16, hotY: 27 },
    { name: "pointer", image: pointerPath, hotX: 14, hotY: 9 },
    { name: "progress", image: progressPath, hotX: 5, hotY: 4 },
    { name: "wait", image: waitPath, hotX: 11, hotY: 11 },
    { name: "cell", image: cellPath, hotX: 15, hotY: 15 },
    { name: "crosshair", image: crosshairPath, hotX: 15, hotY: 15 },
    { name: "text", image: textPath, hotX: 14, hotY: 15 },
    { name: "vertical-text", image: verticalTextPath, hotX: 16, hotY: 15 },
    { name: "alias", image: aliasPath, hotX: 12, hotY: 11 },
    { name: "copy", image: copyPath, hotX: 12, hotY: 11 },
    { name: "move", image: movePath, hotX: 12, hotY: 11 },
    { name: "no-drop", image: noDropPath, hotX: 12, hotY: 11 },
    { name: "not-allowed", image: notAllowedPath, hotX: 12, hotY: 11 },
    { name: "grab", image: grabPath, hotX: 10, hotY: 6 },
    { name: "grabbing", image: grabbingPath, hotX: 15, hotY: 14 },
    { name: "all-scroll", image: allScrollPath, hotX: 15, hotY: 15 },
    { name: "col-resize", image: colResizePath, hotX: 16, hotY: 15 },
    { name: "row-resize", image: rowResizePath, hotX: 15, hotY: 17 },
    { name: "n-resize", image: nResizePath, hotX: 17, hotY: 7 },
    { name: "e-resize", image: eResizePath, hotX: 25, hotY: 17 },
    { name: "s-resize", image: sResizePath, hotX: 17, hotY: 23 },
    { name: "w-resize", image: wResizePath, hotX: 8, hotY: 17 },
    { name: "ne-resize", image: neResizePath, hotX: 20, hotY: 13 },
    { name: "nw-resize", image: nwResizePath, hotX: 13, hotY: 13 },
    { name: "se-resize", image: seResizePath, hotX: 19, hotY: 19 },
    { name: "sw-resize", image: swResizePath, hotX: 13, hotY: 19 },
    { name: "ew-resize", image: ewResizePath, hotX: 16, hotY: 15 },
    { name: "ns-resize", image: nsResizePath, hotX: 15, hotY: 17 },
    { name: "nesw-resize", image: neswResizePath, hotX: 14, hotY: 14 },
    { name: "nwse-resize", image: nwseResizePath, hotX: 14, hotY: 14 },
    { name: "zoom-in", image: zoomInPath, hotX: 14, hotY: 13 },
    { name: "zoom-out", image: zoomOutPath, hotX: 14, hotY: 13 },
];

const textureCache = new Map<string, Gdk.Texture>();

function getCursorTexture(info: CursorInfo): Gdk.Texture {
    const cached = textureCache.get(info.image);
    if (cached) return cached;

    const texture = Gdk.Texture.newFromFilename(info.image);
    textureCache.set(info.image, texture);
    return texture;
}

const CursorPreview = ({ info }: { info: CursorInfo }) => {
    const texture = useMemo(() => getCursorTexture(info), [info]);
    return <GtkPicture paintable={texture} canShrink widthRequest={24} heightRequest={24} />;
};

const CursorRow = ({ info }: { info: CursorInfo }) => {
    const cursors = useMemo(() => {
        const texture = getCursorTexture(info);
        const named = new Gdk.Cursor(info.name, null);
        const image = Gdk.Cursor.newFromTexture(texture, info.hotX, info.hotY, null);

        if (info.name === "gtk-logo") {
            const fallback = new Gdk.Cursor("default", null);
            const imageWithFallback = Gdk.Cursor.newFromTexture(texture, info.hotX, info.hotY, fallback);
            return [image, image, imageWithFallback, imageWithFallback] as const;
        }

        const namedWithFallback = new Gdk.Cursor(
            info.name,
            Gdk.Cursor.newFromTexture(texture, info.hotX, info.hotY, null),
        );
        const imageWithFallback = Gdk.Cursor.newFromTexture(
            texture,
            info.hotX,
            info.hotY,
            new Gdk.Cursor(info.name, null),
        );

        return [named, image, namedWithFallback, imageWithFallback] as const;
    }, [info]);

    return (
        <GtkListBoxRow>
            <GtkBox spacing={10}>
                <CursorPreview info={info} />
                <GtkBox spacing={4}>
                    <GtkFrame>
                        <GtkBox
                            cssClasses={[cursorbgStyle]}
                            widthRequest={32}
                            heightRequest={32}
                            cursor={cursors[0]}
                            tooltipText={`The '${info.name}' cursor`}
                        />
                    </GtkFrame>
                    <GtkFrame>
                        <GtkBox
                            cssClasses={[cursorbgStyle]}
                            widthRequest={32}
                            heightRequest={32}
                            cursor={cursors[1]}
                            tooltipText={`The '${info.name}' cursor from a texture`}
                        />
                    </GtkFrame>
                    <GtkFrame>
                        <GtkBox
                            cssClasses={[cursorbgStyle]}
                            widthRequest={32}
                            heightRequest={32}
                            cursor={cursors[2]}
                            tooltipText={`The '${info.name}' named cursor falling back to a texture cursor`}
                        />
                    </GtkFrame>
                    <GtkFrame>
                        <GtkBox
                            cssClasses={[cursorbgStyle]}
                            widthRequest={32}
                            heightRequest={32}
                            cursor={cursors[3]}
                            tooltipText={`The '${info.name}' texture cursor falling back to a named cursor`}
                        />
                    </GtkFrame>
                </GtkBox>
                <GtkLabel label={info.name} hexpand xalign={0} />
            </GtkBox>
        </GtkListBoxRow>
    );
};

const CursorsDemo = () => (
    <GtkScrolledWindow hscrollbarPolicy={Gtk.PolicyType.NEVER} propagateNaturalHeight hexpand>
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            marginStart={60}
            marginEnd={60}
            marginTop={60}
            marginBottom={60}
            spacing={10}
            halign={Gtk.Align.CENTER}
        >
            <GtkFrame cssClasses={["view"]}>
                <GtkListBox selectionMode={Gtk.SelectionMode.NONE}>
                    {CURSORS.map((info) => (
                        <CursorRow key={info.name} info={info} />
                    ))}
                </GtkListBox>
            </GtkFrame>
        </GtkBox>
    </GtkScrolledWindow>
);

export const cursorsDemo: Demo = {
    id: "cursors",
    title: "Cursors",
    description: "Custom cursor themes and cursor types",
    keywords: ["cursor", "pointer", "mouse", "crosshair", "resize", "Gdk.Cursor"],
    component: CursorsDemo,
    sourceCode,
    defaultWidth: 300,
    defaultHeight: 300,
};
