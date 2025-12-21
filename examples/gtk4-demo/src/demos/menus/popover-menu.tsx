import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkFrame, GtkLabel, GtkMenuButton, GtkPopoverMenu, Menu } from "@gtkx/react";
import { useState } from "react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

const PopoverMenuDemo = () => {
    const [lastAction, setLastAction] = useState<string | null>(null);

    const handleAction = (action: string) => {
        setLastAction(action);
    };

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <GtkLabel label="<GtkPopover Menu" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="About PopoverMenu" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="GtkPopoverMenu displays a menu in a popover. The declarative Menu components (Menu.Item, Menu.Section, Menu.Submenu) allow building menus without imperative Gio.Menu construction. Menu.Item accepts onActivate callbacks and accels for keyboard shortcuts."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </GtkBox>

            <GtkFrame.Root>
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
            </GtkFrame.Root>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Simple Menu" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkMenuButton.Root label="Actions" halign={Gtk.Align.CENTER}>
                    <GtkMenuButton.Popover>
                        <GtkPopoverMenu.Root>
                            <Menu.Item label="New" onActivate={() => handleAction("New")} accels="<Control>n" />
                            <Menu.Item label="Open" onActivate={() => handleAction("Open")} accels="<Control>o" />
                            <Menu.Item label="Save" onActivate={() => handleAction("Save")} accels="<Control>s" />
                        </GtkPopoverMenu.Root>
                    </GtkMenuButton.Popover>
                </GtkMenuButton.Root>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Menu with Sections" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkMenuButton.Root label="Edit" halign={Gtk.Align.CENTER}>
                    <GtkMenuButton.Popover>
                        <GtkPopoverMenu.Root>
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
                        </GtkPopoverMenu.Root>
                    </GtkMenuButton.Popover>
                </GtkMenuButton.Root>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Menu with Submenus" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkMenuButton.Root label="File" halign={Gtk.Align.CENTER}>
                    <GtkMenuButton.Popover>
                        <GtkPopoverMenu.Root>
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
                        </GtkPopoverMenu.Root>
                    </GtkMenuButton.Popover>
                </GtkMenuButton.Root>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Complex Menu" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkMenuButton.Root iconName="open-menu-symbolic" halign={Gtk.Align.CENTER}>
                    <GtkMenuButton.Popover>
                        <GtkPopoverMenu.Root>
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
                        </GtkPopoverMenu.Root>
                    </GtkMenuButton.Popover>
                </GtkMenuButton.Root>
            </GtkBox>
        </GtkBox>
    );
};

export const popoverMenuDemo: Demo = {
    id: "popovermenu",
    title: "<GtkPopover Menu",
    description: "Declarative menu building with GtkPopoverMenu, Menu.Item, Menu.Section, and Menu.Submenu.",
    keywords: ["menu", "popover", "section", "submenu", "GtkPopoverMenu", "declarative"],
    component: PopoverMenuDemo,
    sourcePath: getSourcePath(import.meta.url, "popover-menu.tsx"),
};
