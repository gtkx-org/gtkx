import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkFrame, GtkLabel, GtkMenuButton, Menu } from "@gtkx/react";
import { useState } from "react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

const MenuButtonDemo = () => {
    const [lastAction, setLastAction] = useState<string | null>(null);

    const handleAction = (action: string) => {
        setLastAction(action);
    };

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <GtkLabel label="Menu Button" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="About MenuButton" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="GtkMenuButton is a button that displays a popover menu when clicked. It's commonly used in toolbars and header bars."
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
                <GtkLabel label="Button Styles" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12} halign={Gtk.Align.CENTER}>
                    <GtkMenuButton label="Text Only">
                        <Menu.Item id="action1" label="Action 1" onActivate={() => handleAction("Action 1")} />
                        <Menu.Item id="action2" label="Action 2" onActivate={() => handleAction("Action 2")} />
                        <Menu.Item id="action3" label="Action 3" onActivate={() => handleAction("Action 3")} />
                    </GtkMenuButton>

                    <GtkMenuButton iconName="open-menu-symbolic">
                        <Menu.Item id="option1" label="Option 1" onActivate={() => handleAction("Option 1")} />
                        <Menu.Item id="option2" label="Option 2" onActivate={() => handleAction("Option 2")} />
                        <Menu.Item id="option3" label="Option 3" onActivate={() => handleAction("Option 3")} />
                    </GtkMenuButton>
                </GtkBox>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="File Menu Example" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={8} halign={Gtk.Align.CENTER}>
                    <GtkMenuButton label="File">
                        <Menu.Item id="new" label="New" onActivate={() => handleAction("New")} accels="<Control>n" />
                        <Menu.Item id="open" label="Open" onActivate={() => handleAction("Open")} accels="<Control>o" />
                        <Menu.Item id="save" label="Save" onActivate={() => handleAction("Save")} accels="<Control>s" />
                        <Menu.Item id="save-as" label="Save As..." onActivate={() => handleAction("Save As")} />
                        <Menu.Item id="close" label="Close" onActivate={() => handleAction("Close")} />
                    </GtkMenuButton>

                    <GtkMenuButton label="Edit">
                        <Menu.Section label="History">
                            <Menu.Item
                                id="undo"
                                label="Undo"
                                onActivate={() => handleAction("Undo")}
                                accels="<Control>z"
                            />
                            <Menu.Item
                                id="redo"
                                label="Redo"
                                onActivate={() => handleAction("Redo")}
                                accels="<Control><Shift>z"
                            />
                        </Menu.Section>
                        <Menu.Section label="Clipboard">
                            <Menu.Item
                                id="cut"
                                label="Cut"
                                onActivate={() => handleAction("Cut")}
                                accels="<Control>x"
                            />
                            <Menu.Item
                                id="copy"
                                label="Copy"
                                onActivate={() => handleAction("Copy")}
                                accels="<Control>c"
                            />
                            <Menu.Item
                                id="paste"
                                label="Paste"
                                onActivate={() => handleAction("Paste")}
                                accels="<Control>v"
                            />
                        </Menu.Section>
                    </GtkMenuButton>

                    <GtkMenuButton label="View">
                        <Menu.Item id="zoom-in" label="Zoom In" onActivate={() => handleAction("Zoom In")} />
                        <Menu.Item id="zoom-out" label="Zoom Out" onActivate={() => handleAction("Zoom Out")} />
                        <Menu.Item id="fullscreen" label="Fullscreen" onActivate={() => handleAction("Fullscreen")} />
                    </GtkMenuButton>
                </GtkBox>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Menu with Submenus" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkMenuButton label="Options" halign={Gtk.Align.CENTER}>
                    <Menu.Item id="new-document" label="New Document" onActivate={() => handleAction("New Document")} />
                    <Menu.Item id="open-folder" label="Open Folder" onActivate={() => handleAction("Open Folder")} />
                    <Menu.Submenu label="Recent">
                        <Menu.Item
                            id="recent1"
                            label="project.tsx"
                            onActivate={() => handleAction("Open project.tsx")}
                        />
                        <Menu.Item
                            id="recent2"
                            label="config.json"
                            onActivate={() => handleAction("Open config.json")}
                        />
                        <Menu.Item id="recent3" label="README.md" onActivate={() => handleAction("Open README.md")} />
                    </Menu.Submenu>
                    <Menu.Item id="settings" label="Settings" onActivate={() => handleAction("Settings")} />
                </GtkMenuButton>
            </GtkBox>
        </GtkBox>
    );
};

export const menuButtonDemo: Demo = {
    id: "menubutton",
    title: "Menu Button",
    description: "Button that shows a popover menu when clicked.",
    keywords: ["menu", "button", "popover", "dropdown", "GtkMenuButton"],
    component: MenuButtonDemo,
    sourcePath: getSourcePath(import.meta.url, "menu-button.tsx"),
};
