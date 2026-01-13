import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkFrame, GtkLabel, GtkMenuButton, x } from "@gtkx/react";
import { useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./shortcuts.tsx?raw";

const ShortcutsDemo = () => {
    const [menuActionTriggered, setMenuActionTriggered] = useState<string | null>(null);

    const handleMenuAction = (action: string) => {
        setMenuActionTriggered(action);
        setTimeout(() => setMenuActionTriggered(null), 2000);
    };

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={24} marginStart={20} marginEnd={20} marginTop={20}>
            <GtkLabel label="Keyboard Shortcuts" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="GTK provides comprehensive keyboard shortcut support through GtkShortcutController. Shortcuts can be defined with accelerator strings like '<Control>s' for common actions."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkFrame label="Menu with Keyboard Accelerators">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="Menu items can have keyboard accelerators that activate them directly. These are displayed next to the menu item text."
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
                            <GtkLabel label="Primary+Q (Ctrl on Linux, Cmd on macOS)" cssClasses={["dim-label"]} />
                        </GtkBox>
                        <GtkBox spacing={12}>
                            <GtkLabel label="F5" widthChars={20} xalign={0} cssClasses={["monospace"]} />
                            <GtkLabel label="F5 (no modifier)" cssClasses={["dim-label"]} />
                        </GtkBox>
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Available Modifiers">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="These modifiers can be combined in accelerator strings:"
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />

                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6}>
                        <GtkBox spacing={12}>
                            <GtkLabel label="<Control>" widthChars={15} xalign={0} cssClasses={["monospace"]} />
                            <GtkLabel label="Control key" cssClasses={["dim-label"]} />
                        </GtkBox>
                        <GtkBox spacing={12}>
                            <GtkLabel label="<Shift>" widthChars={15} xalign={0} cssClasses={["monospace"]} />
                            <GtkLabel label="Shift key" cssClasses={["dim-label"]} />
                        </GtkBox>
                        <GtkBox spacing={12}>
                            <GtkLabel label="<Alt>" widthChars={15} xalign={0} cssClasses={["monospace"]} />
                            <GtkLabel label="Alt key" cssClasses={["dim-label"]} />
                        </GtkBox>
                        <GtkBox spacing={12}>
                            <GtkLabel label="<Super>" widthChars={15} xalign={0} cssClasses={["monospace"]} />
                            <GtkLabel label="Super/Windows key" cssClasses={["dim-label"]} />
                        </GtkBox>
                        <GtkBox spacing={12}>
                            <GtkLabel label="<Primary>" widthChars={15} xalign={0} cssClasses={["monospace"]} />
                            <GtkLabel label="Platform-specific (Ctrl/Cmd)" cssClasses={["dim-label"]} />
                        </GtkBox>
                        <GtkBox spacing={12}>
                            <GtkLabel label="<Meta>" widthChars={15} xalign={0} cssClasses={["monospace"]} />
                            <GtkLabel label="Meta key" cssClasses={["dim-label"]} />
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
                        label="Buttons and labels can have mnemonics - underlined letters that activate the widget when pressed with Alt. Use an underscore before the mnemonic character."
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
                        label="Press Alt to see the mnemonic underlines, then press the letter to activate."
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />
                </GtkBox>
            </GtkFrame>

            <GtkButton
                label="Clear Status"
                onClicked={() => {
                    setMenuActionTriggered(null);
                }}
                halign={Gtk.Align.START}
            />
        </GtkBox>
    );
};

export const shortcutsDemo: Demo = {
    id: "shortcuts",
    title: "Shortcuts Window",
    description:
        "GtkShortcutsWindow is a window that shows various application shortcuts in a structured way. The shortcuts that are shown are typically gathered from accelerators added to actions, widgets, etc.",
    keywords: [
        "keyboard",
        "shortcut",
        "accelerator",
        "mnemonic",
        "hotkey",
        "keybinding",
        "GtkShortcutController",
        "key",
        "binding",
    ],
    component: ShortcutsDemo,
    sourceCode,
};
