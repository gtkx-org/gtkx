import * as Gtk from "@gtkx/gi/gtk";
import {
    GtkBox,
    GtkLabel,
    GtkStack,
    GtkStackPage,
    GtkStackSwitcher,
} from "@gtkx/jsx/gtk";
import { useState } from "react";

export const Editor = () => {
    const [stack, setStack] = useState<Gtk.Stack | null>(null);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <GtkStackSwitcher stack={stack} halign={Gtk.Align.CENTER} />
            <GtkStack ref={setStack} vexpand>
                <GtkStackPage name="source" title="Source">
                    <GtkLabel>Markdown source</GtkLabel>
                </GtkStackPage>
                <GtkStackPage name="preview" title="Preview">
                    <GtkLabel>Rendered preview</GtkLabel>
                </GtkStackPage>
            </GtkStack>
        </GtkBox>
    );
};
