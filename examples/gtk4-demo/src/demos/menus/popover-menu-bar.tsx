import * as Gtk from "@gtkx/ffi/gtk";
import { Box, Frame, Label, Menu, PopoverMenuBar } from "@gtkx/react";
import { useState } from "react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

const PopoverMenuBarDemo = () => {
    const [lastAction, setLastAction] = useState<string | null>(null);

    const handleAction = (action: string) => {
        setLastAction(action);
    };

    return (
        <Box orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <Label label="Popover Menu Bar" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label label="About PopoverMenuBar" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label
                    label="GtkPopoverMenuBar displays a traditional horizontal menu bar as an inline widget. Unlike ApplicationMenu which appears in the window titlebar, PopoverMenuBar can be placed anywhere in your layout. It uses the same Menu.Item, Menu.Section, and Menu.Submenu components."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </Box>

            <Frame.Root>
                <Box
                    orientation={Gtk.Orientation.HORIZONTAL}
                    spacing={8}
                    marginStart={12}
                    marginEnd={12}
                    marginTop={8}
                    marginBottom={8}
                >
                    <Label label="Last action:" cssClasses={["dim-label"]} />
                    <Label label={lastAction ?? "(none)"} cssClasses={lastAction ? ["accent"] : ["dim-label"]} />
                </Box>
            </Frame.Root>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label label="Inline Menu Bar" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Frame.Root>
                    <Box orientation={Gtk.Orientation.VERTICAL} spacing={0}>
                        <PopoverMenuBar>
                            <Menu.Submenu label="File">
                                <Menu.Item
                                    label="New"
                                    onActivate={() => handleAction("File > New")}
                                    accels="<Control>n"
                                />
                                <Menu.Item
                                    label="Open"
                                    onActivate={() => handleAction("File > Open")}
                                    accels="<Control>o"
                                />
                                <Menu.Item
                                    label="Save"
                                    onActivate={() => handleAction("File > Save")}
                                    accels="<Control>s"
                                />
                                <Menu.Section>
                                    <Menu.Item
                                        label="Quit"
                                        onActivate={() => handleAction("File > Quit")}
                                        accels="<Control>q"
                                    />
                                </Menu.Section>
                            </Menu.Submenu>
                            <Menu.Submenu label="Edit">
                                <Menu.Item
                                    label="Undo"
                                    onActivate={() => handleAction("Edit > Undo")}
                                    accels="<Control>z"
                                />
                                <Menu.Item
                                    label="Redo"
                                    onActivate={() => handleAction("Edit > Redo")}
                                    accels="<Control><Shift>z"
                                />
                                <Menu.Section>
                                    <Menu.Item
                                        label="Cut"
                                        onActivate={() => handleAction("Edit > Cut")}
                                        accels="<Control>x"
                                    />
                                    <Menu.Item
                                        label="Copy"
                                        onActivate={() => handleAction("Edit > Copy")}
                                        accels="<Control>c"
                                    />
                                    <Menu.Item
                                        label="Paste"
                                        onActivate={() => handleAction("Edit > Paste")}
                                        accels="<Control>v"
                                    />
                                </Menu.Section>
                            </Menu.Submenu>
                            <Menu.Submenu label="View">
                                <Menu.Item
                                    label="Zoom In"
                                    onActivate={() => handleAction("View > Zoom In")}
                                    accels="<Control>plus"
                                />
                                <Menu.Item
                                    label="Zoom Out"
                                    onActivate={() => handleAction("View > Zoom Out")}
                                    accels="<Control>minus"
                                />
                                <Menu.Item
                                    label="Reset Zoom"
                                    onActivate={() => handleAction("View > Reset Zoom")}
                                    accels="<Control>0"
                                />
                            </Menu.Submenu>
                            <Menu.Submenu label="Help">
                                <Menu.Item
                                    label="Documentation"
                                    onActivate={() => handleAction("Help > Documentation")}
                                />
                                <Menu.Item label="About" onActivate={() => handleAction("Help > About")} />
                            </Menu.Submenu>
                        </PopoverMenuBar>
                        <Box
                            orientation={Gtk.Orientation.VERTICAL}
                            spacing={8}
                            marginStart={20}
                            marginEnd={20}
                            marginTop={40}
                            marginBottom={40}
                            hexpand
                            vexpand
                        >
                            <Label label="Content Area" cssClasses={["title-3"]} halign={Gtk.Align.CENTER} />
                            <Label
                                label="The menu bar above is part of the content, not the window titlebar."
                                cssClasses={["dim-label"]}
                                halign={Gtk.Align.CENTER}
                                wrap
                            />
                        </Box>
                    </Box>
                </Frame.Root>
            </Box>
        </Box>
    );
};

export const popoverMenuBarDemo: Demo = {
    id: "popovermenubar",
    title: "Popover Menu Bar",
    description: "Traditional horizontal menu bar as an inline widget using PopoverMenuBar.",
    keywords: ["menu", "menubar", "horizontal", "GtkPopoverMenuBar", "inline"],
    component: PopoverMenuBarDemo,
    sourcePath: getSourcePath(import.meta.url, "popover-menu-bar.tsx"),
};
