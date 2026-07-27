import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkFrame } from "@gtkx/jsx/gtk";
import type { Demo } from "../types.js";
import { useCssResource } from "../../use-css-resource.js";
import accordionCss from "./css-accordion.css?raw";
import sourceCode from "./css-accordion.tsx?raw";

const cssAccordionDemo: Demo = {
    id: "css-accordion",
    title: "Theming/CSS Accordion",
    description: "A simple accordion demo written using CSS transitions and multiple backgrounds",
    keywords: [],
    component: CssAccordionDemo,
    sourceCode,
    defaultWidth: 600,
    defaultHeight: 300,
};

function CssAccordionDemo() {
    useCssResource(accordionCss, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);

    return (
        <GtkFrame name="frame" cssClasses={["accordion"]}>
            <GtkBox
                name="button-box"
                orientation={Gtk.Orientation.HORIZONTAL}
                halign={Gtk.Align.CENTER}
                valign={Gtk.Align.CENTER}
                spacing={0}
            >
                <GtkButton label="This" />
                <GtkButton label="Is" />
                <GtkButton label="A" />
                <GtkButton label="CSS" />
                <GtkButton label="Accordion" />
                <GtkButton label=":-)" />
            </GtkBox>
        </GtkFrame>
    );
}

export { cssAccordionDemo };
