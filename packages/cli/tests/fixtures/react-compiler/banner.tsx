import type * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { createElement, type Ref } from "react";

const Banner = ({ ref, text }: { ref: Ref<Gtk.Label>; text: string }) => {
    const parts: string[] = [text, "create-element"];

    return createElement(GtkLabel, { ref, label: parts.join("-") });
};

export { Banner };
