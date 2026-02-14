import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkPaned, GtkScrolledWindow, GtkTextView, x } from "@gtkx/react";
import { useMemo } from "react";
import type { Demo, DemoProps } from "../types.js";
import sourceCode from "./css-shadows.tsx?raw";
import cssviewCssPath from "./cssview.css?url";
import resetCssPath from "./reset.css?url";
import { useCssEditor } from "./use-css-editor.js";

const DEFAULT_CSS = `@import url("file://${resetCssPath}");
@import url("file://${cssviewCssPath}");

/* You can edit the text in this window to change the
 * appearance of this Window.
 * Be careful, if you screw it up, nothing might be visible
 * anymore. :)
 */

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

const CssShadowsDemo = ({ window }: DemoProps) => {
    const windowClasses = useMemo(() => WINDOW_CLASSES, []);
    const { textViewRef, onBufferChanged } = useCssEditor(window, windowClasses, DEFAULT_CSS);

    return (
        <GtkPaned orientation={Gtk.Orientation.VERTICAL} resizeStartChild={false}>
            <x.Slot for={GtkPaned} id="startChild">
                <GtkBox spacing={6} valign={Gtk.Align.CENTER}>
                    <GtkButton iconName="go-next" />
                    <GtkButton iconName="go-previous" />
                    <GtkButton label="Hello World" />
                </GtkBox>
            </x.Slot>
            <x.Slot for={GtkPaned} id="endChild">
                <GtkScrolledWindow>
                    <GtkTextView ref={textViewRef} onBufferChanged={onBufferChanged} />
                </GtkScrolledWindow>
            </x.Slot>
        </GtkPaned>
    );
};

export const cssShadowsDemo: Demo = {
    id: "css-shadows",
    title: "Theming/Shadows",
    description:
        "Live CSS editing for box-shadow effects. Edit the CSS to experiment with shadows on buttons in real-time.",
    keywords: ["css", "shadow", "box-shadow", "elevation", "depth", "glow", "live", "editing"],
    component: CssShadowsDemo,
    sourceCode,
    defaultWidth: 400,
    defaultHeight: 300,
};
