import * as Adw from "@gtkx/ffi/adw";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkFrame, GtkImage, GtkLabel, GtkMenuButton, useApplication, x } from "@gtkx/react";
import { useCallback, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./shortcuts.tsx?raw";

interface ShortcutDef {
    title: string;
    accelerator: string;
}

interface ShortcutSectionDef {
    title: string | null;
    shortcuts: ShortcutDef[];
}

const shortcutSections: ShortcutSectionDef[] = [
    {
        title: "General",
        shortcuts: [
            { title: "Help", accelerator: "F1" },
            { title: "Preferences", accelerator: "<Control>comma" },
            { title: "Keyboard Shortcuts", accelerator: "<Control>question" },
            { title: "Quit", accelerator: "<Control>q" },
        ],
    },
    {
        title: "File",
        shortcuts: [
            { title: "New", accelerator: "<Control>n" },
            { title: "Open", accelerator: "<Control>o" },
            { title: "Save", accelerator: "<Control>s" },
            { title: "Save As", accelerator: "<Control><Shift>s" },
            { title: "Close", accelerator: "<Control>w" },
        ],
    },
    {
        title: "Edit",
        shortcuts: [
            { title: "Undo", accelerator: "<Control>z" },
            { title: "Redo", accelerator: "<Control><Shift>z" },
            { title: "Cut", accelerator: "<Control>x" },
            { title: "Copy", accelerator: "<Control>c" },
            { title: "Paste", accelerator: "<Control>v" },
            { title: "Select All", accelerator: "<Control>a" },
        ],
    },
    {
        title: "View",
        shortcuts: [
            { title: "Zoom In", accelerator: "<Control>plus" },
            { title: "Zoom Out", accelerator: "<Control>minus" },
            { title: "Reset Zoom", accelerator: "<Control>0" },
            { title: "Full Screen", accelerator: "F11" },
        ],
    },
    {
        title: "Search",
        shortcuts: [
            { title: "Find", accelerator: "<Control>f" },
            { title: "Find and Replace", accelerator: "<Control>h" },
            { title: "Find Next", accelerator: "<Control>g" },
            { title: "Find Previous", accelerator: "<Control><Shift>g" },
        ],
    },
    {
        title: "Navigation",
        shortcuts: [
            { title: "Go to Line", accelerator: "<Control>l" },
            { title: "Go to Definition", accelerator: "F12" },
            { title: "Go to File", accelerator: "<Control>p" },
            { title: "Go to Symbol", accelerator: "<Control><Shift>o" },
        ],
    },
];

const ShortcutsDemo = () => {
    const app = useApplication();
    const [menuActionTriggered, setMenuActionTriggered] = useState<string | null>(null);

    const handleMenuAction = (action: string) => {
        setMenuActionTriggered(action);
        setTimeout(() => setMenuActionTriggered(null), 2000);
    };

    const createShortcutsDialog = useCallback(() => {
        const dialog = new Adw.ShortcutsDialog();

        for (const sectionDef of shortcutSections) {
            const section = new Adw.ShortcutsSection(sectionDef.title);

            for (const shortcutDef of sectionDef.shortcuts) {
                const item = new Adw.ShortcutsItem(shortcutDef.title, shortcutDef.accelerator);
                section.add(item);
            }

            dialog.add(section);
        }

        return dialog;
    }, []);

    const handleOpenShortcuts = useCallback(() => {
        const dialog = createShortcutsDialog();
        const parent = app.getActiveWindow();
        dialog.present(parent ?? undefined);
    }, [app, createShortcutsDialog]);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={24}>
            <GtkLabel label="Keyboard Shortcuts" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="AdwShortcutsDialog displays application keyboard shortcuts in a structured, searchable dialog. Press the button below or use Ctrl+? to open the shortcuts dialog."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkFrame label="Shortcuts Dialog">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="AdwShortcutsDialog organizes shortcuts into titled sections. Each section contains a list of shortcuts with their accelerators. The dialog can be presented as a floating window or bottom sheet depending on screen size."
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />

                    <GtkButton onClicked={handleOpenShortcuts} halign={Gtk.Align.START}>
                        <GtkBox spacing={8}>
                            <GtkImage iconName="preferences-desktop-keyboard-shortcuts-symbolic" />
                            <GtkLabel label="Open Keyboard Shortcuts" />
                        </GtkBox>
                    </GtkButton>

                    <GtkLabel
                        label="The shortcuts dialog includes 6 sections covering general, file, edit, view, search, and navigation shortcuts. Sections are searchable within the dialog."
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label", "caption"]}
                    />
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Menu with Accelerators">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="Menu items can have keyboard accelerators displayed next to them. These accelerators activate the menu action directly."
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />

                    <GtkBox spacing={12}>
                        <GtkMenuButton label="File Menu" iconName="open-menu-symbolic">
                            <x.MenuSection>
                                <x.MenuItem
                                    id="new"
                                    label="New"
                                    onActivate={() => handleMenuAction("New file")}
                                    accels="<Control>n"
                                />
                                <x.MenuItem
                                    id="open"
                                    label="Open"
                                    onActivate={() => handleMenuAction("Open file")}
                                    accels="<Control>o"
                                />
                                <x.MenuItem
                                    id="save"
                                    label="Save"
                                    onActivate={() => handleMenuAction("Save file")}
                                    accels="<Control>s"
                                />
                                <x.MenuItem
                                    id="save-as"
                                    label="Save As..."
                                    onActivate={() => handleMenuAction("Save As...")}
                                    accels="<Control><Shift>s"
                                />
                            </x.MenuSection>
                            <x.MenuSection>
                                <x.MenuItem
                                    id="close"
                                    label="Close"
                                    onActivate={() => handleMenuAction("Close")}
                                    accels="<Control>w"
                                />
                            </x.MenuSection>
                        </GtkMenuButton>

                        <GtkMenuButton label="Edit Menu" iconName="edit-symbolic">
                            <x.MenuSection>
                                <x.MenuItem
                                    id="undo"
                                    label="Undo"
                                    onActivate={() => handleMenuAction("Undo")}
                                    accels="<Control>z"
                                />
                                <x.MenuItem
                                    id="redo"
                                    label="Redo"
                                    onActivate={() => handleMenuAction("Redo")}
                                    accels="<Control><Shift>z"
                                />
                            </x.MenuSection>
                            <x.MenuSection>
                                <x.MenuItem
                                    id="cut"
                                    label="Cut"
                                    onActivate={() => handleMenuAction("Cut")}
                                    accels="<Control>x"
                                />
                                <x.MenuItem
                                    id="copy"
                                    label="Copy"
                                    onActivate={() => handleMenuAction("Copy")}
                                    accels="<Control>c"
                                />
                                <x.MenuItem
                                    id="paste"
                                    label="Paste"
                                    onActivate={() => handleMenuAction("Paste")}
                                    accels="<Control>v"
                                />
                            </x.MenuSection>
                            <x.MenuSection>
                                <x.MenuItem
                                    id="select-all"
                                    label="Select All"
                                    onActivate={() => handleMenuAction("Select All")}
                                    accels="<Control>a"
                                />
                            </x.MenuSection>
                        </GtkMenuButton>
                    </GtkBox>

                    {menuActionTriggered && (
                        <GtkLabel
                            label={`Action triggered: ${menuActionTriggered}`}
                            cssClasses={["dim-label"]}
                            halign={Gtk.Align.START}
                        />
                    )}
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Accelerator Syntax">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="GTK uses a string format to define keyboard accelerators. Modifiers are wrapped in angle brackets."
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />

                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6}>
                        <GtkBox spacing={12}>
                            <GtkLabel label="<Control>s" widthChars={20} xalign={0} cssClasses={["monospace"]} />
                            <GtkLabel label="Ctrl+S" cssClasses={["dim-label"]} />
                        </GtkBox>
                        <GtkBox spacing={12}>
                            <GtkLabel label="<Control><Shift>s" widthChars={20} xalign={0} cssClasses={["monospace"]} />
                            <GtkLabel label="Ctrl+Shift+S" cssClasses={["dim-label"]} />
                        </GtkBox>
                        <GtkBox spacing={12}>
                            <GtkLabel label="<Alt>F4" widthChars={20} xalign={0} cssClasses={["monospace"]} />
                            <GtkLabel label="Alt+F4" cssClasses={["dim-label"]} />
                        </GtkBox>
                        <GtkBox spacing={12}>
                            <GtkLabel label="<Primary>q" widthChars={20} xalign={0} cssClasses={["monospace"]} />
                            <GtkLabel label="Platform primary key (Ctrl/Cmd)" cssClasses={["dim-label"]} />
                        </GtkBox>
                        <GtkBox spacing={12}>
                            <GtkLabel label="F5" widthChars={20} xalign={0} cssClasses={["monospace"]} />
                            <GtkLabel label="F5 (no modifier)" cssClasses={["dim-label"]} />
                        </GtkBox>
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Button Mnemonics">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="Buttons can have mnemonics - underlined letters activated with Alt. Use an underscore before the mnemonic character in the label."
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />

                    <GtkBox spacing={12}>
                        <GtkButton label="_Save" useUnderline onClicked={() => handleMenuAction("Save (Alt+S)")} />
                        <GtkButton label="_Open" useUnderline onClicked={() => handleMenuAction("Open (Alt+O)")} />
                        <GtkButton label="_Quit" useUnderline onClicked={() => handleMenuAction("Quit (Alt+Q)")} />
                    </GtkBox>

                    <GtkLabel
                        label="Press Alt to see the underlines, then press the letter to activate."
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label", "caption"]}
                    />
                </GtkBox>
            </GtkFrame>
        </GtkBox>
    );
};

export const shortcutsDemo: Demo = {
    id: "shortcuts",
    title: "Shortcuts Window",
    description: "AdwShortcutsDialog displays application keyboard shortcuts in a structured, searchable dialog",
    keywords: [
        "keyboard",
        "shortcut",
        "accelerator",
        "mnemonic",
        "hotkey",
        "keybinding",
        "AdwShortcutsDialog",
        "AdwShortcutsSection",
        "AdwShortcutsItem",
        "key",
        "binding",
        "adwaita",
    ],
    component: ShortcutsDemo,
    sourceCode,
};
