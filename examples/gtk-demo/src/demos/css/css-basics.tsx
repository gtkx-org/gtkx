import { GtkScrolledWindow, GtkTextView } from "@gtkx/react";
import { useMemo } from "react";
import type { Demo, DemoProps } from "../types.js";
import sourceCode from "./css-basics.tsx?raw";
import resetCssPath from "./reset.css";
import { useCssEditor } from "./use-css-editor.js";

const DEFAULT_CSS = `@import url("file://${resetCssPath}");

/* You can edit the text in this window to change the
 * appearance of this Window.
 * Be careful, if you screw it up, nothing might be visible
 * anymore. :)
 */

/* Set a very futuristic style by default */
.demo * {
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

const CssBasicsDemo = ({ window }: DemoProps) => {
    const windowClasses = useMemo(() => WINDOW_CLASSES, []);
    const { textViewRef, onBufferChanged } = useCssEditor(window, windowClasses, DEFAULT_CSS);

    return (
        <GtkScrolledWindow hexpand vexpand>
            <GtkTextView ref={textViewRef} onBufferChanged={onBufferChanged} />
        </GtkScrolledWindow>
    );
};

export const cssBasicsDemo: Demo = {
    id: "css-basics",
    title: "Theming/CSS Basics",
    description:
        "GTK themes are written using CSS. Every widget is build of multiple items that you can style very similarly to a regular website.",
    keywords: ["css", "style", "theme", "theming", "GtkCssProvider"],
    component: CssBasicsDemo,
    sourceCode,
    defaultWidth: 400,
    defaultHeight: 300,
};
