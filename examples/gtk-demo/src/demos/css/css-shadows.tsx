import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkPaned, GtkScrolledWindow, GtkTextView } from "@gtkx/jsx/gtk";
import type { Demo } from "../types.js";
import sourceCode from "./css-shadows.tsx?raw";
import cssviewCssPath from "./cssview.css?url";
import resetCssPath from "./reset.css?url";
import { useCssEditor } from "./use-css-editor.js";

const DEFAULT_CSS = `/* You can edit the text in this window to change the
 * appearance of this Window.
 * Be careful, if you screw it up, nothing might be visible
 * anymore. :)
 */

/* This CSS resets all properties to their defaults values
 * and overrides all user settings and the theme in use
 */
@import url("file://${resetCssPath}");
@import url("file://${cssviewCssPath}");

/* Get a nice background for the window */
window.demo.background {
  background-color: #4870bc;
  background-image: linear-gradient(to left, transparent, rgba(255,255,255,.07) 50%, transparent 50%),
                    linear-gradient(to left, transparent, rgba(255,255,255,.13) 50%, transparent 50%),
                    linear-gradient(to left, transparent, transparent 50%, rgba(255,255,255,.17) 50%),
                    linear-gradient(to left, transparent, transparent 50%, rgba(255,255,255,.19) 50%);
  background-size: 29px, 59px, 73px, 109px;
}

window.demo button {
  color: black;
  padding: 10px;
  border-radius: 5px;
  transition: all 250ms ease-in;
  border: 1px transparent solid;
}

window.demo button:hover {
  text-shadow: 3px 3px 5px alpha(black, 0.75);
  -gtk-icon-shadow: 3px 3px 5px alpha(black, 0.75);
  box-shadow: 3px 3px 5px alpha(black, 0.5) inset;
  border: solid 1px alpha(black, 0.75);
}

window.demo button:active {
  padding: 11px 9px 9px 11px;
  text-shadow: 1px 1px 2.5px alpha(black, 0.6);
  -gtk-icon-shadow: 1px 1px 2.5px alpha(black, 0.6);
}`;

const WINDOW_CLASSES = ["demo", "background"];

const CssShadowsDemo = () => {
    const { textViewRef, onBufferChanged } = useCssEditor(DEFAULT_CSS);

    return (
        <GtkPaned
            name="paned"
            orientation={Gtk.Orientation.VERTICAL}
            resizeStartChild={false}
            startChild={
                <GtkBox spacing={6} valign={Gtk.Align.CENTER}>
                    <GtkButton iconName="go-next" />
                    <GtkButton iconName="go-previous" />
                    <GtkButton label="Hello World" />
                </GtkBox>
            }
            endChild={
                <GtkScrolledWindow>
                    <GtkTextView name="text-view" ref={textViewRef} onBufferChanged={onBufferChanged}>
                        {DEFAULT_CSS}
                    </GtkTextView>
                </GtkScrolledWindow>
            }
        />
    );
};

export const cssShadowsDemo: Demo = {
    id: "css-shadows",
    title: "Theming/Shadows",
    description: "This demo shows how to use CSS shadows.",
    keywords: [],
    component: CssShadowsDemo,
    sourceCode,
    defaultWidth: 400,
    defaultHeight: 300,
    windowCssClasses: WINDOW_CLASSES,
};
