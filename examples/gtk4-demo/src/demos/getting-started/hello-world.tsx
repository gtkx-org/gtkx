import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkLabel } from "@gtkx/react";
import { useState } from "react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

const HelloWorldDemo = () => {
    const [greeting, setGreeting] = useState("Hello, World!");

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12} halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER}>
            <GtkLabel label={greeting} cssClasses={["title-1"]} />
            <GtkButton
                label="Say Hello"
                cssClasses={["suggested-action"]}
                onClicked={() => setGreeting("Hello from GTKX!")}
            />
        </GtkBox>
    );
};

export const helloWorldDemo: Demo = {
    id: "hello-world",
    title: "Hello World",
    description: "A simple introduction to GTKX with a greeting message and button.",
    keywords: ["hello", "intro", "getting-started", "GtkLabel", "GtkButton"],
    component: HelloWorldDemo,
    sourcePath: getSourcePath(import.meta.url, "hello-world.tsx"),
};
