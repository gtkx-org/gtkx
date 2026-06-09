import * as Gtk from "@gtkx/gi/gtk";
import { GtkDrawingArea } from "@gtkx/react";
import {
    GtkBox,
    GtkButton,
    GtkOverlay,
    GtkOverlayChild,
    GtkPaned,
    GtkScrolledWindow,
    GtkTextView,
} from "@gtkx/react-gi/gtk";
import type { Demo } from "../types.js";
import brickUri from "./brick.png";
import brick2Uri from "./brick2.png";
import sourceCode from "./css-multiplebgs.tsx?raw";
import cssviewCssPath from "./cssview.css?url";
import resetCssPath from "./reset.css?url";
import { useCssEditor } from "./use-css-editor.js";

const DEFAULT_CSS = `/* You can edit the text in this window to change the
 * appearance of this Window.
 * Be careful, if you screw it up, nothing might be visible
 * anymore. :)
 */

/* This CSS resets all properties to their defaults values
 *    and overrides all user settings and the theme in use */
@import url("file://${resetCssPath}");
@import url("file://${cssviewCssPath}");

#canvas {
    transition-property: background-color, background-image;
    transition-duration: 0.5s;

    background-color: #4870bc;
}

/* The gradients below are adapted versions of Lea Verou's CSS3 patterns,
 * licensed under the MIT license:
 * Copyright (c) 2011 Lea Verou, http://lea.verou.me/
 *
 * See https://github.com/LeaVerou/CSS3-Patterns-Gallery
 */

/**********
 * Bricks *
 **********/
/*
@define-color brick_hi #d42;
@define-color brick_lo #b42;
@define-color brick_hi_backdrop #888;
@define-color brick_lo_backdrop #999;

#canvas {
    background-color: #999;
    background-image: linear-gradient(205deg, @brick_lo, @brick_lo 23px, transparent 23px),
                      linear-gradient(25deg, @brick_hi, @brick_hi 23px, transparent 23px),
                      linear-gradient(205deg, @brick_lo, @brick_lo 23px, transparent 23px),
                      linear-gradient(25deg, @brick_hi, @brick_hi 23px, transparent 23px);
    background-size: 58px 58px;
    background-position: 0px 6px, 4px 31px, 29px 35px, 34px 2px;
}

#canvas:backdrop {
    background-color: #444;
    background-image: linear-gradient(205deg, @brick_lo_backdrop, @brick_lo_backdrop 23px, transparent 23px),
                      linear-gradient(25deg, @brick_hi_backdrop, @brick_hi_backdrop 23px, transparent 23px),
                      linear-gradient(205deg, @brick_lo_backdrop, @brick_lo_backdrop 23px, transparent 23px),
                      linear-gradient(25deg, @brick_hi_backdrop, @brick_hi_backdrop 23px, transparent 23px);
    background-size: 58px 58px;
    background-position: 0px 6px, 4px 31px, 29px 35px, 34px 2px;
}
*/

/*
#bricks-button {
    background-color: #eef;
    background-image: -gtk-scaled(url('${brickUri}'),url('${brick2Uri}'));
    background-repeat: no-repeat;
    background-position: center;
}

*/
/**********
 * Tartan *
 **********/
/*
@define-color tartan_bg #662e2c;
@define-color tartan_bg_backdrop #333;

#canvas {
    background-color: @tartan_bg;
    background-image: repeating-linear-gradient(transparent, transparent 50px, rgba(0,0,0,.4) 50px,
                                                rgba(0,0,0,.4) 53px, transparent 53px, transparent 63px,
                                                rgba(0,0,0,.4) 63px, rgba(0,0,0,.4) 66px, transparent 66px,
                                                transparent 116px, rgba(0,0,0,.5) 116px, rgba(0,0,0,.5) 166px,
                                                rgba(255,255,255,.2) 166px, rgba(255,255,255,.2) 169px, rgba(0,0,0,.5) 169px,
                                                rgba(0,0,0,.5) 179px, rgba(255,255,255,.2) 179px, rgba(255,255,255,.2) 182px,
                                                rgba(0,0,0,.5) 182px, rgba(0,0,0,.5) 232px, transparent 232px),
                      repeating-linear-gradient(90deg, transparent, transparent 50px, rgba(0,0,0,.4) 50px, rgba(0,0,0,.4) 53px,
                                                transparent 53px, transparent 63px, rgba(0,0,0,.4) 63px, rgba(0,0,0,.4) 66px,
                                                transparent 66px, transparent 116px, rgba(0,0,0,.5) 116px, rgba(0,0,0,.5) 166px,
                                                rgba(255,255,255,.2) 166px, rgba(255,255,255,.2) 169px, rgba(0,0,0,.5) 169px,
                                                rgba(0,0,0,.5) 179px, rgba(255,255,255,.2) 179px, rgba(255,255,255,.2) 182px,
                                                rgba(0,0,0,.5) 182px, rgba(0,0,0,.5) 232px, transparent 232px),
                      repeating-linear-gradient(-55deg, transparent, transparent 1px, rgba(0,0,0,.2) 1px, rgba(0,0,0,.2) 4px,
                                                transparent 4px, transparent 19px, rgba(0,0,0,.2) 19px,
                                                rgba(0,0,0,.2) 24px, transparent 24px, transparent 51px, rgba(0,0,0,.2) 51px,
                                                rgba(0,0,0,.2) 54px, transparent 54px, transparent 74px);
}

#canvas:backdrop {
    background-color: @tartan_bg_backdrop;
}
*/

/***********
 * Stripes *
 ***********/

/*
@define-color base_bg #4870bc;
@define-color backdrop_bg #555;

#canvas {
  background-color: @base_bg;
  background-image: linear-gradient(to left, transparent, rgba(255,255,255,.07) 50%, transparent 50%),
                    linear-gradient(to left, transparent, rgba(255,255,255,.13) 50%, transparent 50%),
                    linear-gradient(to left, transparent, transparent 50%, rgba(255,255,255,.17) 50%),
                    linear-gradient(to left, transparent, transparent 50%, rgba(255,255,255,.19) 50%);
  background-size: 29px, 59px, 73px, 109px;
}

#canvas:backdrop {
  background-color: @backdrop_bg;
}
*/

/***************
 * Lined Paper *
 ***************/
/*
#canvas {
    background-color: #fff;
    background-image: linear-gradient(90deg, transparent 79px, alpha(#f98195, 0.40) 79px, #f98195 80px, alpha(#f98195, 0.40) 81px, transparent 81px),
                      linear-gradient(alpha(#77c5cf, 0.60), alpha(#77c5cf, 0.60) 1px, transparent 1px);
    background-size: 100% 36px;
}

#canvas:backdrop {
    background-color: #f1f2f4;
    background-image: linear-gradient(90deg, transparent 79px, alpha(#999, 0.40) 79px, #999 80px, alpha(#999, 0.40) 81px, transparent 81px),
                      linear-gradient(alpha(#bbb, 0.60), alpha(#bbb, 0.60) 1px, transparent 1px);
}
*/`;

const WINDOW_CLASSES = ["demo"];

const CssMultiplebgsDemo = () => {
    const { textViewRef, onBufferChanged } = useCssEditor(DEFAULT_CSS);

    return (
        <GtkOverlay name="overlay">
            <GtkDrawingArea name="canvas" hexpand vexpand />
            <GtkOverlayChild>
                <GtkButton
                    name="bricks-button"
                    halign={Gtk.Align.CENTER}
                    valign={Gtk.Align.CENTER}
                    widthRequest={250}
                    heightRequest={84}
                />
            </GtkOverlayChild>
            <GtkOverlayChild>
                <GtkPaned
                    name="paned"
                    orientation={Gtk.Orientation.VERTICAL}
                    startChild={<GtkBox />}
                    endChild={
                        <GtkScrolledWindow>
                            <GtkTextView name="text-view" ref={textViewRef} onBufferChanged={onBufferChanged}>
                                {DEFAULT_CSS}
                            </GtkTextView>
                        </GtkScrolledWindow>
                    }
                />
            </GtkOverlayChild>
        </GtkOverlay>
    );
};

export const cssMultiplebgsDemo: Demo = {
    id: "css-multiplebgs",
    title: "Theming/Multiple Backgrounds",
    description:
        "GTK themes are written using CSS. Every widget is build of multiple items that you can style very similarly to a regular website.",
    keywords: [],
    component: CssMultiplebgsDemo,
    sourceCode,
    defaultWidth: 400,
    defaultHeight: 300,
    windowCssClasses: WINDOW_CLASSES,
};
