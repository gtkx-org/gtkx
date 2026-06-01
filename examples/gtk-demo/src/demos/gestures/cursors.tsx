import * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkFrame, GtkImage, GtkLabel, GtkListBox, GtkListBoxRow, GtkScrolledWindow } from "@gtkx/react";
import { useMemo } from "react";
import { useCssResource } from "../../use-css-resource.js";
import type { Demo } from "../types.js";
import { path as aliasPath } from "./cursors/alias_cursor.png";
import { path as allResizePath } from "./cursors/all_resize_cursor.png";
import { path as allScrollPath } from "./cursors/all_scroll_cursor.png";
import { path as cellPath } from "./cursors/cell_cursor.png";
import { path as colResizePath } from "./cursors/col_resize_cursor.png";
import { path as contextMenuPath } from "./cursors/context_menu_cursor.png";
import { path as copyPath } from "./cursors/copy_cursor.png";
import { path as crosshairPath } from "./cursors/crosshair_cursor.png";
import { path as defaultPath } from "./cursors/default_cursor.png";
import { path as dndAskPath } from "./cursors/dnd_ask_cursor.png";
import { path as eResizePath } from "./cursors/e_resize_cursor.png";
import { path as ewResizePath } from "./cursors/ew_resize_cursor.png";
import { path as grabPath } from "./cursors/grab_cursor.png";
import { path as grabbingPath } from "./cursors/grabbing_cursor.png";
import { path as gtkLogoPath } from "./cursors/gtk_logo_cursor.png";
import { path as helpPath } from "./cursors/help_cursor.png";
import { path as movePath } from "./cursors/move_cursor.png";
import { path as nResizePath } from "./cursors/n_resize_cursor.png";
import { path as neResizePath } from "./cursors/ne_resize_cursor.png";
import { path as neswResizePath } from "./cursors/nesw_resize_cursor.png";
import { path as noDropPath } from "./cursors/no_drop_cursor.png";
import { path as nonePath } from "./cursors/none_cursor.png";
import { path as notAllowedPath } from "./cursors/not_allowed_cursor.png";
import { path as nsResizePath } from "./cursors/ns_resize_cursor.png";
import { path as nwResizePath } from "./cursors/nw_resize_cursor.png";
import { path as nwseResizePath } from "./cursors/nwse_resize_cursor.png";
import { path as pointerPath } from "./cursors/pointer_cursor.png";
import { path as progressPath } from "./cursors/progress_cursor.png";
import { path as rowResizePath } from "./cursors/row_resize_cursor.png";
import { path as sResizePath } from "./cursors/s_resize_cursor.png";
import { path as seResizePath } from "./cursors/se_resize_cursor.png";
import { path as swResizePath } from "./cursors/sw_resize_cursor.png";
import { path as textPath } from "./cursors/text_cursor.png";
import { path as verticalTextPath } from "./cursors/vertical_text_cursor.png";
import { path as wResizePath } from "./cursors/w_resize_cursor.png";
import { path as waitPath } from "./cursors/wait_cursor.png";
import { path as zoomInPath } from "./cursors/zoom_in_cursor.png";
import { path as zoomOutPath } from "./cursors/zoom_out_cursor.png";
import cursorsCss from "./cursors.css?raw";
import sourceCode from "./cursors.tsx?raw";

interface CursorInfo {
    name: string;
    image: string;
    hotX: number;
    hotY: number;
}

const GROUPS: readonly (readonly CursorInfo[])[] = [
    [
        { name: "default", image: defaultPath, hotX: 5, hotY: 5 },
        { name: "none", image: nonePath, hotX: 0, hotY: 0 },
        { name: "gtk-logo", image: gtkLogoPath, hotX: 18, hotY: 2 },
    ],
    [
        { name: "context-menu", image: contextMenuPath, hotX: 5, hotY: 5 },
        { name: "help", image: helpPath, hotX: 16, hotY: 27 },
        { name: "pointer", image: pointerPath, hotX: 14, hotY: 9 },
        { name: "progress", image: progressPath, hotX: 5, hotY: 4 },
        { name: "wait", image: waitPath, hotX: 11, hotY: 11 },
    ],
    [
        { name: "cell", image: cellPath, hotX: 15, hotY: 15 },
        { name: "crosshair", image: crosshairPath, hotX: 15, hotY: 15 },
        { name: "text", image: textPath, hotX: 14, hotY: 15 },
        { name: "vertical-text", image: verticalTextPath, hotX: 16, hotY: 15 },
    ],
    [
        { name: "alias", image: aliasPath, hotX: 12, hotY: 11 },
        { name: "copy", image: copyPath, hotX: 12, hotY: 11 },
        { name: "move", image: movePath, hotX: 12, hotY: 11 },
        { name: "dnd-ask", image: dndAskPath, hotX: 12, hotY: 11 },
        { name: "no-drop", image: noDropPath, hotX: 12, hotY: 11 },
        { name: "not-allowed", image: notAllowedPath, hotX: 12, hotY: 11 },
        { name: "grab", image: grabPath, hotX: 10, hotY: 6 },
        { name: "grabbing", image: grabbingPath, hotX: 15, hotY: 14 },
    ],
    [
        { name: "all-scroll", image: allScrollPath, hotX: 15, hotY: 15 },
        { name: "all-resize", image: allResizePath, hotX: 15, hotY: 15 },
        { name: "col-resize", image: colResizePath, hotX: 16, hotY: 15 },
        { name: "row-resize", image: rowResizePath, hotX: 15, hotY: 17 },
        { name: "n-resize", image: nResizePath, hotX: 17, hotY: 7 },
        { name: "e-resize", image: eResizePath, hotX: 25, hotY: 17 },
        { name: "s-resize", image: sResizePath, hotX: 17, hotY: 23 },
        { name: "w-resize", image: wResizePath, hotX: 8, hotY: 17 },
        { name: "ne-resize", image: neResizePath, hotX: 20, hotY: 13 },
        { name: "nw-resize", image: nwResizePath, hotX: 13, hotY: 13 },
        { name: "sw-resize", image: swResizePath, hotX: 13, hotY: 19 },
        { name: "se-resize", image: seResizePath, hotX: 19, hotY: 19 },
        { name: "ew-resize", image: ewResizePath, hotX: 16, hotY: 15 },
        { name: "ns-resize", image: nsResizePath, hotX: 15, hotY: 17 },
        { name: "nesw-resize", image: neswResizePath, hotX: 14, hotY: 14 },
        { name: "nwse-resize", image: nwseResizePath, hotX: 14, hotY: 14 },
    ],
    [
        { name: "zoom-in", image: zoomInPath, hotX: 14, hotY: 13 },
        { name: "zoom-out", image: zoomOutPath, hotX: 14, hotY: 13 },
    ],
];

const textureCache = new Map<string, Gdk.Texture>();

function getCursorTexture(info: CursorInfo): Gdk.Texture {
    const cached = textureCache.get(info.image);
    if (cached) return cached;

    const texture = Gdk.Texture.newFromResource(info.image);
    textureCache.set(info.image, texture);
    return texture;
}

const buildCursorVariants = (info: CursorInfo) => {
    const texture = getCursorTexture(info);
    const named = Gdk.Cursor.newFromName(info.name, null);
    const image = Gdk.Cursor.newFromTexture(texture, info.hotX, info.hotY, null);

    if (info.name === "gtk-logo") {
        const defaultFallback = Gdk.Cursor.newFromName("default", null);
        const imageWithDefaultFallback = Gdk.Cursor.newFromTexture(texture, info.hotX, info.hotY, defaultFallback);
        const imageWithFallback = Gdk.Cursor.newFromTexture(texture, info.hotX, info.hotY, defaultFallback);
        return [named, image, imageWithDefaultFallback, imageWithFallback] as const;
    }

    const namedWithFallback = Gdk.Cursor.newFromName(
        info.name,
        Gdk.Cursor.newFromTexture(texture, info.hotX, info.hotY, null),
    );
    const imageWithFallback = Gdk.Cursor.newFromTexture(
        texture,
        info.hotX,
        info.hotY,
        Gdk.Cursor.newFromName(info.name, null),
    );
    return [named, image, namedWithFallback, imageWithFallback] as const;
};

const buildCursorTooltips = (info: CursorInfo): readonly [string, string, string, string] =>
    info.name === "gtk-logo"
        ? [
              `The "gtk-logo" named cursor`,
              "An image cursor for the GTK logo",
              `An image cursor falling back to the "default" cursor`,
              `An image cursor falling back to the "default" cursor`,
          ]
        : [
              `The "${info.name}" named cursor`,
              "An image cursor",
              `The "${info.name}" named cursor falling back to an image cursor`,
              `An image cursor falling back to the "${info.name}" cursor`,
          ];

const CursorPreview = ({ info }: { info: CursorInfo }) => {
    const texture = useMemo(() => getCursorTexture(info), [info]);
    return <GtkImage paintable={texture} />;
};

const CursorFrame = ({ cursor, tooltip }: { cursor: Gdk.Cursor; tooltip: string }) => (
    <GtkFrame widthRequest={32} heightRequest={32} cssClasses={["cursorbg"]} cursor={cursor} tooltipText={tooltip} />
);

const CursorRow = ({ info }: { info: CursorInfo }) => {
    const cursors = useMemo(() => buildCursorVariants(info), [info]);
    const tooltips = useMemo(() => buildCursorTooltips(info), [info]);
    return (
        <GtkListBoxRow activatable={false}>
            <GtkBox spacing={10} marginStart={10} marginEnd={10} marginTop={10} marginBottom={10}>
                <CursorPreview info={info} />
                <GtkLabel label={info.name} halign={Gtk.Align.START} valign={Gtk.Align.BASELINE} hexpand xalign={0} />
                <CursorFrame cursor={cursors[0]} tooltip={tooltips[0]} />
                <CursorFrame cursor={cursors[1]} tooltip={tooltips[1]} />
                <CursorFrame cursor={cursors[2]} tooltip={tooltips[2]} />
                <CursorFrame cursor={cursors[3]} tooltip={tooltips[3]} />
            </GtkBox>
        </GtkListBoxRow>
    );
};

const CursorGroup = ({ rows }: { rows: readonly CursorInfo[] }) => (
    <GtkFrame cssClasses={["view"]}>
        <GtkListBox selectionMode={Gtk.SelectionMode.NONE}>
            {rows.map((info) => (
                <CursorRow key={info.name} info={info} />
            ))}
        </GtkListBox>
    </GtkFrame>
);

const CursorsDemo = () => {
    useCssResource(cursorsCss);
    return (
        <GtkScrolledWindow name="scrolled" hscrollbarPolicy={Gtk.PolicyType.NEVER} propagateNaturalHeight hexpand>
            <GtkBox
                orientation={Gtk.Orientation.VERTICAL}
                marginStart={60}
                marginEnd={60}
                marginTop={60}
                marginBottom={60}
                spacing={10}
                halign={Gtk.Align.CENTER}
            >
                {GROUPS.map((rows) => (
                    <CursorGroup key={rows[0]?.name ?? ""} rows={rows} />
                ))}
            </GtkBox>
        </GtkScrolledWindow>
    );
};

export const cursorsDemo: Demo = {
    id: "cursors",
    title: "Cursors",
    description:
        "Demonstrates a useful set of available cursors. The cursors shown here are the ones defined by CSS, which we assume to be available. The example shows creating cursors by name or from an image, with or without a fallback.",
    keywords: [],
    component: CursorsDemo,
    sourceCode,
    defaultWidth: 300,
    defaultHeight: 300,
};
