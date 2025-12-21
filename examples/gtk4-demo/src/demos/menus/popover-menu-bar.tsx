import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkFrame, GtkLabel, GtkPopoverMenuBar, Menu } from "@gtkx/react";
import { useState } from "react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

const PopoverMenuBarDemo = () => {
    const [lastAction, setLastAction] = useState<string | null>(null);

    const handleAction = (action: string) => {
        setLastAction(action);
    };

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <GtkLabel label="GtkPopover Menu Bar" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="About PopoverMenuBar" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="GtkPopoverMenuBar displays a traditional horizontal menu bar as an inline widget. Unlike ApplicationMenu which appears in the window titlebar, GtkPopoverMenuBar can be placed anywhere in your layout. It uses the same Menu.Item, Menu.Section, and Menu.Submenu components."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </GtkBox>

            <GtkFrame>
                <GtkBox
                    orientation={Gtk.Orientation.HORIZONTAL}
                    spacing={8}
                    marginStart={12}
                    marginEnd={12}
                    marginTop={8}
                    marginBottom={8}
                >
                    <GtkLabel label="Last action:" cssClasses={["dim-label"]} />
                    <GtkLabel label={lastAction ?? "(none)"} cssClasses={lastAction ? ["accent"] : ["dim-label"]} />
                </GtkBox>
            </GtkFrame>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Inline Menu Bar" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkFrame>
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={0}>
                        <GtkPopoverMenuBar>
                            <Menu.Submenu label="File">
                                <Menu.Item
                                    id="new"
                                    label="New"
                                    onActivate={() => handleAction("File > New")}
                                    accels="<Control>n"
                                />
                                <Menu.Item
                                    id="open"
                                    label="Open"
                                    onActivate={() => handleAction("File > Open")}
                                    accels="<Control>o"
                                />
                                <Menu.Item
                                    id="save"
                                    label="Save"
                                    onActivate={() => handleAction("File > Save")}
                                    accels="<Control>s"
                                />
                                <Menu.Section>
                                    <Menu.Item
                                        id="quit"
                                        label="Quit"
                                        onActivate={() => handleAction("File > Quit")}
                                        accels="<Control>q"
                                    />
                                </Menu.Section>
                            </Menu.Submenu>
                            <Menu.Submenu label="Edit">
                                <Menu.Item
                                    id="undo"
                                    label="Undo"
                                    onActivate={() => handleAction("Edit > Undo")}
                                    accels="<Control>z"
                                />
                                <Menu.Item
                                    id="redo"
                                    label="Redo"
                                    onActivate={() => handleAction("Edit > Redo")}
                                    accels="<Control><Shift>z"
                                />
                                <Menu.Section>
                                    <Menu.Item
                                        id="cut"
                                        label="Cut"
                                        onActivate={() => handleAction("Edit > Cut")}
                                        accels="<Control>x"
                                    />
                                    <Menu.Item
                                        id="copy"
                                        label="Copy"
                                        onActivate={() => handleAction("Edit > Copy")}
                                        accels="<Control>c"
                                    />
                                    <Menu.Item
                                        id="paste"
                                        label="Paste"
                                        onActivate={() => handleAction("Edit > Paste")}
                                        accels="<Control>v"
                                    />
                                </Menu.Section>
                            </Menu.Submenu>
                            <Menu.Submenu label="View">
                                <Menu.Item
                                    id="zoom-in"
                                    label="Zoom In"
                                    onActivate={() => handleAction("View > Zoom In")}
                                    accels="<Control>plus"
                                />
                                <Menu.Item
                                    id="zoom-out"
                                    label="Zoom Out"
                                    onActivate={() => handleAction("View > Zoom Out")}
                                    accels="<Control>minus"
                                />
                                <Menu.Item
                                    id="reset-zoom"
                                    label="Reset Zoom"
                                    onActivate={() => handleAction("View > Reset Zoom")}
                                    accels="<Control>0"
                                />
                            </Menu.Submenu>
                            <Menu.Submenu label="Help">
                                <Menu.Item
                                    id="documentation"
                                    label="Documentation"
                                    onActivate={() => handleAction("Help > Documentation")}
                                />
                                <Menu.Item id="about" label="About" onActivate={() => handleAction("Help > About")} />
                            </Menu.Submenu>
                        </GtkPopoverMenuBar>
                        <GtkBox
                            orientation={Gtk.Orientation.VERTICAL}
                            spacing={8}
                            marginStart={20}
                            marginEnd={20}
                            marginTop={40}
                            marginBottom={40}
                            hexpand
                            vexpand
                        >
                            <GtkLabel label="Content Area" cssClasses={["title-3"]} halign={Gtk.Align.CENTER} />
                            <GtkLabel
                                label="The menu bar above is part of the content, not the window titlebar."
                                cssClasses={["dim-label"]}
                                halign={Gtk.Align.CENTER}
                                wrap
                            />
                        </GtkBox>
                    </GtkBox>
                </GtkFrame>
            </GtkBox>
        </GtkBox>
    );
};

export const popoverMenuBarDemo: Demo = {
    id: "popovermenubar",
    title: "GtkPopover Menu Bar",
    description: "Traditional horizontal menu bar as an inline widget using <GtkPopoverMenuBar.",
    keywords: ["menu", "menubar", "horizontal", "GtkPopoverMenuBar", "inline"],
    component: PopoverMenuBarDemo,
    sourcePath: getSourcePath(import.meta.url, "popover-menu-bar.tsx"),
};
