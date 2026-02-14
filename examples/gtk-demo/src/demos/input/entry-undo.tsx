import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkEntry, GtkLabel } from "@gtkx/react";
import { useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./entry-undo.tsx?raw";

const EntryUndoDemo = () => {
    const [label, setLabel] = useState<Gtk.Label | null>(null);

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={12}
            marginStart={18}
            marginEnd={18}
            marginTop={18}
            marginBottom={18}
        >
            <GtkLabel ref={setLabel} label="Use Control+z or Control+Shift+z to undo or redo changes" />
            <GtkEntry accessibleLabelledBy={label ? [label] : undefined} enableUndo />
        </GtkBox>
    );
};

export const entryUndoDemo: Demo = {
    id: "entry-undo",
    title: "Entry/Undo and Redo",
    description:
        "GtkEntry can provide basic Undo/Redo support using standard keyboard accelerators such as Control+z to undo and Control+Shift+z to redo. Additionally, Control+y can be used to redo.",
    keywords: ["entry", "undo", "redo", "GtkEntry", "enableUndo"],
    component: EntryUndoDemo,
    sourceCode,
};
