import * as Gtk from "@gtkx/ffi/gtk";
import { Box, Button, Label, MenuButton, Popover } from "@gtkx/react";
import { useState } from "react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

const PopoverDemo = () => {
    const [clicks, setClicks] = useState(0);

    return (
        <Box orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <Label.Root label="Popover" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="About Popover" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label.Root
                    label="GtkPopover is a bubble-like context popup. It appears relative to a parent widget and can contain any content."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Menu Button with Popover" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <MenuButton.Root label="Open Popover" halign={Gtk.Align.CENTER}>
                    <MenuButton.Popover>
                        <Popover.Root>
                            <Popover.Child>
                                <Box
                                    orientation={Gtk.Orientation.VERTICAL}
                                    spacing={8}
                                    marginStart={12}
                                    marginEnd={12}
                                    marginTop={12}
                                    marginBottom={12}
                                >
                                    <Label.Root label="Popover Content" cssClasses={["heading"]} />
                                    <Label.Root label="This is inside a popover!" cssClasses={["dim-label"]} />
                                    <Button
                                        label={`Clicked ${clicks} times`}
                                        onClicked={() => setClicks((c) => c + 1)}
                                        cssClasses={["suggested-action"]}
                                    />
                                </Box>
                            </Popover.Child>
                        </Popover.Root>
                    </MenuButton.Popover>
                </MenuButton.Root>
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Actions Menu" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <MenuButton.Root label="Actions" iconName="view-more-symbolic" halign={Gtk.Align.CENTER}>
                    <MenuButton.Popover>
                        <Popover.Root>
                            <Popover.Child>
                                <Box
                                    orientation={Gtk.Orientation.VERTICAL}
                                    spacing={4}
                                    marginStart={8}
                                    marginEnd={8}
                                    marginTop={8}
                                    marginBottom={8}
                                >
                                    <Button label="New Document" cssClasses={["flat"]} />
                                    <Button label="Open..." cssClasses={["flat"]} />
                                    <Button label="Save" cssClasses={["flat"]} />
                                    <Button label="Save As..." cssClasses={["flat"]} />
                                </Box>
                            </Popover.Child>
                        </Popover.Root>
                    </MenuButton.Popover>
                </MenuButton.Root>
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Features" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label.Root
                    label="Popovers support custom positioning, autohide behavior, and can be triggered by any widget using MenuButton."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </Box>
        </Box>
    );
};

export const popoverDemo: Demo = {
    id: "popover",
    title: "Popover",
    description: "Bubble-like context popup for additional content.",
    keywords: ["popover", "popup", "bubble", "tooltip", "GtkPopover"],
    component: PopoverDemo,
    sourcePath: getSourcePath(import.meta.url, "popover.tsx"),
};
