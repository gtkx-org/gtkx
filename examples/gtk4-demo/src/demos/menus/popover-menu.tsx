import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkFrame, GtkLabel, GtkMenuButton, GtkPopoverMenu, Menu, Slot } from "@gtkx/react";
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
            <GtkLabel label="GtkPopover Menu" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="About PopoverMenu" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="GtkPopoverMenu displays a menu in a popover. The declarative Menu components (Menu.Item, Menu.Section, Menu.Submenu) allow building menus without imperative Gio.Menu construction. Menu.Item accepts onActivate callbacks and accels for keyboard shortcuts."
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
                <GtkLabel label="Simple Menu" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkMenuButton label="Actions" halign={Gtk.Align.CENTER}>
                    <Slot for={GtkMenuButton} id="popover">
                        <GtkPopoverMenu>
                            <Menu.Item
                                id="new"
                                label="New"
                                onActivate={() => handleAction("New")}
                                accels="<Control>n"
                            />
                            <Menu.Item
                                id="open"
                                label="Open"
                                onActivate={() => handleAction("Open")}
                                accels="<Control>o"
                            />
                            <Menu.Item
                                id="save"
                                label="Save"
                                onActivate={() => handleAction("Save")}
                                accels="<Control>s"
                            />
                        </GtkPopoverMenu>
                    </Slot>
                </GtkMenuButton>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Menu with Sections" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkMenuButton label="Edit" halign={Gtk.Align.CENTER}>
                    <Slot for={GtkMenuButton} id="popover">
                        <GtkPopoverMenu>
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
                        </GtkPopoverMenu>
                    </Slot>
                </GtkMenuButton>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Menu with Submenus" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkMenuButton label="File" halign={Gtk.Align.CENTER}>
                    <Slot for={GtkMenuButton} id="popover">
                        <GtkPopoverMenu>
                            <Menu.Item id="new" label="New" onActivate={() => handleAction("New")} />
                            <Menu.Item id="open" label="Open" onActivate={() => handleAction("Open")} />
                            <Menu.Submenu label="Recent Files">
                                <Menu.Item
                                    id="document"
                                    label="document.txt"
                                    onActivate={() => handleAction("Open document.txt")}
                                />
                                <Menu.Item
                                    id="report"
                                    label="report.pdf"
                                    onActivate={() => handleAction("Open report.pdf")}
                                />
                                <Menu.Item
                                    id="image"
                                    label="image.png"
                                    onActivate={() => handleAction("Open image.png")}
                                />
                            </Menu.Submenu>
                            <Menu.Item id="save" label="Save" onActivate={() => handleAction("Save")} />
                            <Menu.Submenu label="Export As">
                                <Menu.Item id="pdf" label="PDF" onActivate={() => handleAction("Export PDF")} />
                                <Menu.Item id="html" label="HTML" onActivate={() => handleAction("Export HTML")} />
                                <Menu.Item
                                    id="markdown"
                                    label="Markdown"
                                    onActivate={() => handleAction("Export Markdown")}
                                />
                            </Menu.Submenu>
                        </GtkPopoverMenu>
                    </Slot>
                </GtkMenuButton>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Complex Menu" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkMenuButton iconName="open-menu-symbolic" halign={Gtk.Align.CENTER}>
                    <Slot for={GtkMenuButton} id="popover">
                        <GtkPopoverMenu>
                            <Menu.Section>
                                <Menu.Item
                                    id="preferences"
                                    label="Preferences"
                                    onActivate={() => handleAction("Preferences")}
                                    accels="<Control>comma"
                                />
                                <Menu.Item
                                    id="shortcuts"
                                    label="Keyboard Shortcuts"
                                    onActivate={() => handleAction("Keyboard Shortcuts")}
                                    accels="<Control>question"
                                />
                            </Menu.Section>
                            <Menu.Section>
                                <Menu.Submenu label="Support">
                                    <Menu.Item
                                        id="documentation"
                                        label="Documentation"
                                        onActivate={() => handleAction("Documentation")}
                                    />
                                    <Menu.Item
                                        id="report-issue"
                                        label="Report Issue"
                                        onActivate={() => handleAction("Report Issue")}
                                    />
                                    <Menu.Item id="about" label="About" onActivate={() => handleAction("About")} />
                                </Menu.Submenu>
                            </Menu.Section>
                            <Menu.Section>
                                <Menu.Item
                                    id="quit"
                                    label="Quit"
                                    onActivate={() => handleAction("Quit")}
                                    accels="<Control>q"
                                />
                            </Menu.Section>
                        </GtkPopoverMenu>
                    </Slot>
                </GtkMenuButton>
            </GtkBox>
        </GtkBox>
    );
};

export const popoverMenuDemo: Demo = {
    id: "popovermenu",
    title: "GtkPopover Menu",
    description: "Declarative menu building with GtkPopoverMenu, Menu.Item, Menu.Section, and Menu.Submenu.",
    keywords: ["menu", "popover", "section", "submenu", "GtkPopoverMenu", "declarative"],
    component: PopoverMenuDemo,
    sourcePath: getSourcePath(import.meta.url, "popover-menu.tsx"),
};
