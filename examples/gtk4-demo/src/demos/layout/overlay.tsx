import * as Gtk from "@gtkx/ffi/gtk";
import { Box, Button, Label, Overlay } from "@gtkx/react";
import { useState } from "react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

const OverlayDemo = () => {
    const [badgeCount, setBadgeCount] = useState(3);

    return (
        <Box orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <Label label="Overlay" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label label="About Overlay" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label
                    label="Overlay stacks widgets on top of each other. The first child is the main content, and subsequent children are overlaid on top."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label label="Badge Example" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={12} halign={Gtk.Align.START}>
                    <Overlay>
                        <Button label="Notifications" widthRequest={120} heightRequest={40} />
                        <Label
                            label={String(badgeCount)}
                            cssClasses={["badge"]}
                            halign={Gtk.Align.END}
                            valign={Gtk.Align.START}
                            marginEnd={4}
                            marginTop={4}
                        />
                    </Overlay>
                    <Button label="+" onClicked={() => setBadgeCount((c) => c + 1)} />
                    <Button label="-" onClicked={() => setBadgeCount((c) => Math.max(0, c - 1))} />
                </Box>
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label label="Corner Labels" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Box
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={0}
                    cssClasses={["card"]}
                    marginTop={8}
                    marginBottom={8}
                    marginStart={8}
                    marginEnd={8}
                >
                    <Overlay>
                        <Box
                            orientation={Gtk.Orientation.VERTICAL}
                            spacing={0}
                            widthRequest={200}
                            heightRequest={100}
                            halign={Gtk.Align.CENTER}
                            valign={Gtk.Align.CENTER}
                        >
                            <Label label="Main Content" cssClasses={["dim-label"]} />
                        </Box>
                        <Label
                            label="TL"
                            halign={Gtk.Align.START}
                            valign={Gtk.Align.START}
                            marginStart={8}
                            marginTop={8}
                        />
                        <Label label="TR" halign={Gtk.Align.END} valign={Gtk.Align.START} marginEnd={8} marginTop={8} />
                        <Label
                            label="BL"
                            halign={Gtk.Align.START}
                            valign={Gtk.Align.END}
                            marginStart={8}
                            marginBottom={8}
                        />
                        <Label
                            label="BR"
                            halign={Gtk.Align.END}
                            valign={Gtk.Align.END}
                            marginEnd={8}
                            marginBottom={8}
                        />
                    </Overlay>
                </Box>
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label label="Usage" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label
                    label="Use halign and valign props on overlay children to position them. The first child becomes the base layer."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </Box>
        </Box>
    );
};

export const overlayDemo: Demo = {
    id: "overlay",
    title: "Overlay",
    description: "Container that stacks widgets on top of each other.",
    keywords: ["overlay", "stack", "layer", "badge", "GtkOverlay"],
    component: OverlayDemo,
    sourcePath: getSourcePath(import.meta.url, "overlay.tsx"),
};
