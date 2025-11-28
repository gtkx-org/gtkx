import * as Gtk from "@gtkx/ffi/gtk";
import { Box, Button, Label } from "@gtkx/react";
import type { Demo } from "../types.js";

export const BoxDemo = () => {
    return (
        <Box orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <Label.Root label="Box Layout" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Horizontal Box" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Box
                    orientation={Gtk.Orientation.HORIZONTAL}
                    spacing={12}
                    cssClasses={["card"]}
                    marginTop={8}
                    marginBottom={8}
                    marginStart={8}
                    marginEnd={8}
                >
                    <Button label="First" />
                    <Button label="Second" />
                    <Button label="Third" />
                </Box>
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Vertical Box" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Box
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={8}
                    cssClasses={["card"]}
                    marginTop={8}
                    marginBottom={8}
                    marginStart={8}
                    marginEnd={8}
                >
                    <Button label="Top" />
                    <Button label="Middle" />
                    <Button label="Bottom" />
                </Box>
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Expand and Fill" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Box
                    orientation={Gtk.Orientation.HORIZONTAL}
                    spacing={12}
                    cssClasses={["card"]}
                    marginTop={8}
                    marginBottom={8}
                    marginStart={8}
                    marginEnd={8}
                >
                    <Button label="Fixed" />
                    <Button label="Expand" hexpand />
                    <Button label="Fixed" />
                </Box>
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Alignment" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Box
                    orientation={Gtk.Orientation.HORIZONTAL}
                    spacing={12}
                    cssClasses={["card"]}
                    marginTop={8}
                    marginBottom={8}
                    marginStart={8}
                    marginEnd={8}
                    heightRequest={80}
                >
                    <Button label="Start" valign={Gtk.Align.START} />
                    <Button label="Center" valign={Gtk.Align.CENTER} />
                    <Button label="End" valign={Gtk.Align.END} />
                    <Button label="Fill" valign={Gtk.Align.FILL} vexpand />
                </Box>
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Homogeneous" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label.Root
                    label="When homogeneous is true, all children get the same size."
                    wrap
                    cssClasses={["dim-label"]}
                />
                <Box
                    orientation={Gtk.Orientation.HORIZONTAL}
                    spacing={12}
                    homogeneous
                    cssClasses={["card"]}
                    marginTop={8}
                    marginBottom={8}
                    marginStart={8}
                    marginEnd={8}
                >
                    <Button label="Short" />
                    <Button label="Medium Text" />
                    <Button label="Longer Button Text" />
                </Box>
            </Box>
        </Box>
    );
};

export const boxDemo: Demo = {
    id: "box",
    title: "Box",
    description: "Linear container for arranging widgets horizontally or vertically.",
    keywords: ["box", "layout", "container", "horizontal", "vertical", "GtkBox"],
    component: BoxDemo,
    source: `import * as Gtk from "@gtkx/ffi/gtk";
import { Box, Button, Label } from "@gtkx/react";

export const BoxDemo = () => {
    return (
        <Box orientation={Gtk.Orientation.VERTICAL} spacing={20}>
            <Label.Root label="Box Layout" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Horizontal Box" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                    <Button label="First" />
                    <Button label="Second" />
                    <Button label="Third" />
                </Box>
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Vertical Box" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Box orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                    <Button label="Top" />
                    <Button label="Middle" />
                    <Button label="Bottom" />
                </Box>
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Expand and Fill" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                    <Button label="Fixed" />
                    <Button label="Expand" hexpand />
                    <Button label="Fixed" />
                </Box>
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Homogeneous" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={12} homogeneous>
                    <Button label="Short" />
                    <Button label="Medium Text" />
                    <Button label="Longer Button Text" />
                </Box>
            </Box>
        </Box>
    );
};`,
};
