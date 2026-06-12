import { GtkDropDown } from "@gtkx/jsx/gtk";
import { useState } from "react";

const renderers = [
    { id: "cairo", value: "Cairo (software)" },
    { id: "gl", value: "OpenGL" },
    { id: "vulkan", value: "Vulkan" },
];

export const Demo = () => {
    const [selected, setSelected] = useState("gl");

    return (
        <GtkDropDown items={renderers} selectedId={selected} onSelectionChanged={(id) => setSelected(id ?? "cairo")} />
    );
};
