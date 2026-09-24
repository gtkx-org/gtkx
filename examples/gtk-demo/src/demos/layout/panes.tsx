import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkFrame, GtkLabel, GtkPaned } from "@gtkx/jsx/gtk";
import type { Demo } from "../types.js";
import sourceCode from "./panes.tsx?raw";

const panesDemo: Demo = {
    id: "panes",
    title: "Paned Widgets",
    description:
        "GtkPaned divides its content into two resizable panes. This demo nests a horizontal pair inside " +
        "a vertical pair and supplies both children through JSX props.",
    keywords: [],
    component: PanesDemo,
    sourceCode,
    defaultWidth: 330,
    defaultHeight: 250,
    isResizable: false,
};

const renderLabel = (label: string) => (
    <GtkLabel marginStart={4} marginEnd={4} marginTop={4} marginBottom={4} hexpand vexpand>
        {label}
    </GtkLabel>
);

const renderInnerPaned = () => (
    <GtkPaned
        name="panes-inner"
        shrinkStartChild={false}
        shrinkEndChild={false}
        startChild={renderLabel("Hi there")}
        endChild={renderLabel("Hello")}
    />
);

function PanesDemo() {
    return (
        <GtkBox
            name="panes-root"
            orientation={Gtk.Orientation.VERTICAL}
            spacing={8}
            marginStart={8}
            marginEnd={8}
            marginTop={8}
            marginBottom={8}
        >
            <GtkFrame name="panes-frame">
                <GtkPaned
                    name="panes-outer"
                    orientation={Gtk.Orientation.VERTICAL}
                    shrinkStartChild={false}
                    shrinkEndChild={false}
                    startChild={renderInnerPaned()}
                    endChild={renderLabel("Goodbye")}
                />
            </GtkFrame>
        </GtkBox>
    );
}

export { panesDemo };
