import * as Gtk from "@gtkx/ffi/gtk";
import { Box, Frame, Label, Menu, MenuButton, PopoverMenu } from "@gtkx/react";
import { useState } from "react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

const PopoverMenuDemo = () => {
    const [lastAction, setLastAction] = useState<string | null>(null);

    const handleAction = (action: string) => {
        setLastAction(action);
    };

    return (
        <Box orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <Label label="Popover Menu" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label label="About PopoverMenu" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label
                    label="GtkPopoverMenu displays a menu in a popover. The declarative Menu components (Menu.Item, Menu.Section, Menu.Submenu) allow building menus without imperative Gio.Menu construction. Menu.Item accepts onActivate callbacks and accels for keyboard shortcuts."
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
                <Label label="Simple Menu" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <MenuButton.Root label="Actions" halign={Gtk.Align.CENTER}>
                    <MenuButton.Popover>
                        <PopoverMenu.Root>
                            <Menu.Item label="New" onActivate={() => handleAction("New")} accels="<Control>n" />
                            <Menu.Item label="Open" onActivate={() => handleAction("Open")} accels="<Control>o" />
                            <Menu.Item label="Save" onActivate={() => handleAction("Save")} accels="<Control>s" />
                        </PopoverMenu.Root>
                    </MenuButton.Popover>
                </MenuButton.Root>
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label label="Menu with Sections" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <MenuButton.Root label="Edit" halign={Gtk.Align.CENTER}>
                    <MenuButton.Popover>
                        <PopoverMenu.Root>
                            <Menu.Section label="History">
                                <Menu.Item label="Undo" onActivate={() => handleAction("Undo")} accels="<Control>z" />
                                <Menu.Item
                                    label="Redo"
                                    onActivate={() => handleAction("Redo")}
                                    accels="<Control><Shift>z"
                                />
                            </Menu.Section>
                            <Menu.Section label="Clipboard">
                                <Menu.Item label="Cut" onActivate={() => handleAction("Cut")} accels="<Control>x" />
                                <Menu.Item label="Copy" onActivate={() => handleAction("Copy")} accels="<Control>c" />
                                <Menu.Item label="Paste" onActivate={() => handleAction("Paste")} accels="<Control>v" />
                            </Menu.Section>
                        </PopoverMenu.Root>
                    </MenuButton.Popover>
                </MenuButton.Root>
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label label="Menu with Submenus" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <MenuButton.Root label="File" halign={Gtk.Align.CENTER}>
                    <MenuButton.Popover>
                        <PopoverMenu.Root>
                            <Menu.Item label="New" onActivate={() => handleAction("New")} />
                            <Menu.Item label="Open" onActivate={() => handleAction("Open")} />
                            <Menu.Submenu label="Recent Files">
                                <Menu.Item label="document.txt" onActivate={() => handleAction("Open document.txt")} />
                                <Menu.Item label="report.pdf" onActivate={() => handleAction("Open report.pdf")} />
                                <Menu.Item label="image.png" onActivate={() => handleAction("Open image.png")} />
                            </Menu.Submenu>
                            <Menu.Item label="Save" onActivate={() => handleAction("Save")} />
                            <Menu.Submenu label="Export As">
                                <Menu.Item label="PDF" onActivate={() => handleAction("Export PDF")} />
                                <Menu.Item label="HTML" onActivate={() => handleAction("Export HTML")} />
                                <Menu.Item label="Markdown" onActivate={() => handleAction("Export Markdown")} />
                            </Menu.Submenu>
                        </PopoverMenu.Root>
                    </MenuButton.Popover>
                </MenuButton.Root>
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label label="Complex Menu" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <MenuButton.Root iconName="open-menu-symbolic" halign={Gtk.Align.CENTER}>
                    <MenuButton.Popover>
                        <PopoverMenu.Root>
                            <Menu.Section>
                                <Menu.Item
                                    label="Preferences"
                                    onActivate={() => handleAction("Preferences")}
                                    accels="<Control>comma"
                                />
                                <Menu.Item
                                    label="Keyboard Shortcuts"
                                    onActivate={() => handleAction("Keyboard Shortcuts")}
                                    accels="<Control>question"
                                />
                            </Menu.Section>
                            <Menu.Section>
                                <Menu.Submenu label="Support">
                                    <Menu.Item label="Documentation" onActivate={() => handleAction("Documentation")} />
                                    <Menu.Item label="Report Issue" onActivate={() => handleAction("Report Issue")} />
                                    <Menu.Item label="About" onActivate={() => handleAction("About")} />
                                </Menu.Submenu>
                            </Menu.Section>
                            <Menu.Section>
                                <Menu.Item label="Quit" onActivate={() => handleAction("Quit")} accels="<Control>q" />
                            </Menu.Section>
                        </PopoverMenu.Root>
                    </MenuButton.Popover>
                </MenuButton.Root>
            </Box>
        </Box>
    );
};

export const popoverMenuDemo: Demo = {
    id: "popovermenu",
    title: "Popover Menu",
    description: "Declarative menu building with PopoverMenu, Menu.Item, Menu.Section, and Menu.Submenu.",
    keywords: ["menu", "popover", "section", "submenu", "GtkPopoverMenu", "declarative"],
    component: PopoverMenuDemo,
    sourcePath: getSourcePath(import.meta.url, "popover-menu.tsx"),
};
