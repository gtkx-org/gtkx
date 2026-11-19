import { DropDown } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import { useState } from "react";

const SOURCE_TYPES = ["Book", "Article", "Podcast"];

export const SourceTypePicker = () => {
    const [sourceType, setSourceType] = useState("Article");

    return (
        <DropDown
            items={SOURCE_TYPES.map((type) => ({ id: type, value: type }))}
            selectedId={sourceType}
            onSelectionChanged={(id) => {
                if (id !== null) setSourceType(id);
            }}
            halign={Gtk.Align.CENTER}
            valign={Gtk.Align.START}
            marginTop={12}
        />
    );
};
