import { GtkScrolledWindow } from "@gtkx/jsx/gtk";
import type { Demo } from "../types.js";
import sourceCode from "./css-basics.tsx?raw";
import { CssEditor } from "./css-editor.js";
import resetCssPath from "./reset.css?url";

const DEFAULT_CSS = `/* You can edit the text in this window to change the
 * appearance of this Window.
 * Be careful, if you screw it up, nothing might be visible
 * anymore. :)
 */

/* This resets all properties to their defaults values
 * and overrides all user settings and the theme in use
 */
@import url("file://${resetCssPath}");

/* Set a very futuristic style by default */
.demo textview {
  color: green;
  font-family: Monospace;
  border: 1px solid;
}

window.demo {
  background-color: white;
}

/* Make sure selections are visible */
.demo selection {
  background-color: darkGreen;
  color: black;
}
`;

const WINDOW_CLASSES = ["demo"];

const cssBasicsDemo: Demo = {
    id: "css-basics",
    title: "Theming/CSS Basics",
    description:
        "GTK themes are written using CSS. Every widget is built from multiple elements that you can style " +
        "similarly to a regular website.",
    keywords: [],
    component: CssBasicsDemo,
    sourceCode,
    defaultWidth: 400,
    defaultHeight: 300,
    windowCssClasses: WINDOW_CLASSES,
};

function CssBasicsDemo() {
    return (
        <GtkScrolledWindow hexpand vexpand>
            <CssEditor defaultCss={DEFAULT_CSS} />
        </GtkScrolledWindow>
    );
}

export { cssBasicsDemo };
