import * as Gtk from "@gtkx/ffi/gtk";
import { Box, Button, CenterBox, Label } from "@gtkx/react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

export const CenterBoxDemo = () => {
    return (
        <Box orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <Label.Root label="Center Box" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Horizontal CenterBox" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label.Root
                    label="CenterBox has three slots: start, center, and end. The center widget is always centered."
                    wrap
                    cssClasses={["dim-label"]}
                />
                <CenterBox.Root hexpand cssClasses={["card"]} marginTop={8} marginBottom={8}>
                    <CenterBox.StartWidget>
                        <Button label="Start" marginStart={8} />
                    </CenterBox.StartWidget>
                    <CenterBox.CenterWidget>
                        <Label.Root label="Center" cssClasses={["heading"]} />
                    </CenterBox.CenterWidget>
                    <CenterBox.EndWidget>
                        <Button label="End" marginEnd={8} />
                    </CenterBox.EndWidget>
                </CenterBox.Root>
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Toolbar Example" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <CenterBox.Root hexpand cssClasses={["toolbar"]}>
                    <CenterBox.StartWidget>
                        <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={6} marginStart={6}>
                            <Button label="Back" cssClasses={["flat"]} />
                            <Button label="Forward" cssClasses={["flat"]} />
                        </Box>
                    </CenterBox.StartWidget>
                    <CenterBox.CenterWidget>
                        <Label.Root label="Document.txt" cssClasses={["title-4"]} />
                    </CenterBox.CenterWidget>
                    <CenterBox.EndWidget>
                        <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={6} marginEnd={6}>
                            <Button label="Share" cssClasses={["flat"]} />
                            <Button label="Menu" cssClasses={["flat"]} />
                        </Box>
                    </CenterBox.EndWidget>
                </CenterBox.Root>
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Vertical CenterBox" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <CenterBox.Root
                    orientation={Gtk.Orientation.VERTICAL}
                    vexpand
                    heightRequest={200}
                    cssClasses={["card"]}
                >
                    <CenterBox.StartWidget>
                        <Label.Root label="Top" marginTop={12} />
                    </CenterBox.StartWidget>
                    <CenterBox.CenterWidget>
                        <Button label="Centered Content" cssClasses={["suggested-action"]} />
                    </CenterBox.CenterWidget>
                    <CenterBox.EndWidget>
                        <Label.Root label="Bottom" marginBottom={12} />
                    </CenterBox.EndWidget>
                </CenterBox.Root>
            </Box>
        </Box>
    );
};

export const centerBoxDemo: Demo = {
    id: "center-box",
    title: "Center Box",
    description: "Three-slot container with start, center, and end positions.",
    keywords: ["center", "box", "layout", "slots", "GtkCenterBox"],
    component: CenterBoxDemo,
    sourcePath: getSourcePath(import.meta.url, "center-box.tsx"),
};
