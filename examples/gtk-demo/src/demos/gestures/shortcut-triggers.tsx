import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkFrame, GtkLabel, GtkMenuButton, Menu } from "@gtkx/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./shortcut-triggers.tsx?raw";

const ShortcutTriggersDemo = () => {
    const [lastTriggered, setLastTriggered] = useState<string | null>(null);
    const [triggerInfo, setTriggerInfo] = useState<string | null>(null);
    const boxRef = useRef<Gtk.Box | null>(null);

    const showTrigger = useCallback((name: string, details?: string) => {
        setLastTriggered(name);
        setTriggerInfo(details ?? null);
        setTimeout(() => {
            setLastTriggered(null);
            setTriggerInfo(null);
        }, 2000);
    }, []);

    // Set up shortcut controller on mount
    useEffect(() => {
        const box = boxRef.current;
        if (!box) return;

        // Create shortcut controller
        const controller = new Gtk.ShortcutController();
        controller.setScope(Gtk.ShortcutScope.LOCAL);

        // Create a simple keyval trigger (Ctrl+1)
        const keyvalTrigger = new Gtk.ShortcutTrigger("<Control>1");

        // Create an alternative trigger that fires on either Ctrl+2 OR Ctrl+Shift+2
        const trigger2a = new Gtk.ShortcutTrigger("<Control>2");
        const trigger2b = new Gtk.ShortcutTrigger("<Control><Shift>2");
        const alternativeTrigger = new Gtk.AlternativeTrigger(trigger2a, trigger2b);

        // Create a mnemonic trigger for Alt+M
        const mnemonicTrigger = new Gtk.MnemonicTrigger(0x006d); // 'm' keyval

        // Create a never trigger (demonstrates disabled shortcuts)
        const neverTrigger = Gtk.NeverTrigger.get();

        // Create callback actions for each shortcut
        const createAction = (name: string, details: string) => {
            return new Gtk.CallbackAction((_widget: Gtk.Widget, _args: unknown) => {
                showTrigger(name, details);
                return true;
            });
        };

        // Create shortcuts and add to controller
        const shortcut1 = new Gtk.Shortcut(keyvalTrigger, createAction("KeyvalTrigger", "Triggered by Ctrl+1"));
        controller.addShortcut(shortcut1);

        const shortcut2 = new Gtk.Shortcut(
            alternativeTrigger,
            createAction("AlternativeTrigger", "Triggered by Ctrl+2 OR Ctrl+Shift+2"),
        );
        controller.addShortcut(shortcut2);

        const shortcut3 = new Gtk.Shortcut(mnemonicTrigger, createAction("MnemonicTrigger", "Triggered by Alt+M"));
        controller.addShortcut(shortcut3);

        // Never trigger - this shortcut will never fire
        const shortcut4 = new Gtk.Shortcut(neverTrigger, createAction("NeverTrigger", "This should never trigger"));
        controller.addShortcut(shortcut4);

        // Add controller to widget
        box.addController(controller);
    }, [showTrigger]);

    return (
        <GtkBox
            ref={boxRef}
            orientation={Gtk.Orientation.VERTICAL}
            spacing={24}
            marginStart={20}
            marginEnd={20}
            marginTop={20}
            focusable
        >
            <GtkLabel label="Shortcut Triggers" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="GtkShortcutTrigger defines how shortcuts are activated. GTK4 provides several trigger types that can be combined for flexible keyboard shortcut handling."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            {/* Status Display */}
            <GtkFrame label="Trigger Status">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={8}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label={lastTriggered ? `Triggered: ${lastTriggered}` : "Press a shortcut key combination"}
                        halign={Gtk.Align.START}
                        cssClasses={lastTriggered ? ["success"] : ["dim-label"]}
                    />
                    {triggerInfo && (
                        <GtkLabel label={triggerInfo} halign={Gtk.Align.START} cssClasses={["dim-label"]} />
                    )}
                </GtkBox>
            </GtkFrame>

            {/* Trigger Types */}
            <GtkFrame label="ShortcutTrigger Types">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={16}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    {/* KeyvalTrigger */}
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={4}>
                        <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                            <GtkLabel label="ShortcutTrigger" widthChars={20} xalign={0} cssClasses={["heading"]} />
                            <GtkLabel label="Ctrl+1" cssClasses={["dim-label"]} />
                        </GtkBox>
                        <GtkLabel
                            label="Basic keyval trigger from parsed accelerator string. Created with new ShortcutTrigger('<Control>1')."
                            wrap
                            halign={Gtk.Align.START}
                            cssClasses={["dim-label"]}
                        />
                    </GtkBox>

                    {/* AlternativeTrigger */}
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={4}>
                        <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                            <GtkLabel label="AlternativeTrigger" widthChars={20} xalign={0} cssClasses={["heading"]} />
                            <GtkLabel label="Ctrl+2 or Ctrl+Shift+2" cssClasses={["dim-label"]} />
                        </GtkBox>
                        <GtkLabel
                            label="Combines two triggers - fires when either one matches. Useful for providing multiple ways to trigger the same action."
                            wrap
                            halign={Gtk.Align.START}
                            cssClasses={["dim-label"]}
                        />
                    </GtkBox>

                    {/* MnemonicTrigger */}
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={4}>
                        <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                            <GtkLabel label="MnemonicTrigger" widthChars={20} xalign={0} cssClasses={["heading"]} />
                            <GtkLabel label="Alt+M" cssClasses={["dim-label"]} />
                        </GtkBox>
                        <GtkLabel
                            label="Triggers when mnemonics are active (Alt key held) and the specified key is pressed. Used for menu and button mnemonics."
                            wrap
                            halign={Gtk.Align.START}
                            cssClasses={["dim-label"]}
                        />
                    </GtkBox>

                    {/* NeverTrigger */}
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={4}>
                        <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                            <GtkLabel label="NeverTrigger" widthChars={20} xalign={0} cssClasses={["heading"]} />
                            <GtkLabel label="(disabled)" cssClasses={["dim-label"]} />
                        </GtkBox>
                        <GtkLabel
                            label="A trigger that never fires. Useful for temporarily disabling shortcuts without removing them from the controller."
                            wrap
                            halign={Gtk.Align.START}
                            cssClasses={["dim-label"]}
                        />
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            {/* GtkShortcutController */}
            <GtkFrame label="GtkShortcutController">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="GtkShortcutController manages a set of shortcuts on a widget. It processes key events and triggers the appropriate actions."
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />

                    <GtkLabel label="Controller Scopes:" halign={Gtk.Align.START} cssClasses={["heading"]} />
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={4}>
                        <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                            <GtkLabel label="LOCAL" widthChars={12} xalign={0} cssClasses={["monospace"]} />
                            <GtkLabel label="Shortcuts only active when widget has focus" cssClasses={["dim-label"]} />
                        </GtkBox>
                        <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                            <GtkLabel label="MANAGED" widthChars={12} xalign={0} cssClasses={["monospace"]} />
                            <GtkLabel label="Shortcuts managed by a parent controller" cssClasses={["dim-label"]} />
                        </GtkBox>
                        <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                            <GtkLabel label="GLOBAL" widthChars={12} xalign={0} cssClasses={["monospace"]} />
                            <GtkLabel label="Shortcuts active anywhere in the window" cssClasses={["dim-label"]} />
                        </GtkBox>
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            {/* Menu with Accelerators */}
            <GtkFrame label="Menu Accelerators">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="Menus can define accelerators that work as global shortcuts. These are displayed next to the menu item text."
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />

                    <GtkMenuButton label="Actions Menu" iconName="open-menu-symbolic">
                        <Menu.Section>
                            <Menu.Item
                                id="action1"
                                label="Primary Action"
                                onActivate={() => showTrigger("Menu Action", "Primary Action triggered")}
                                accels="<Control>p"
                            />
                            <Menu.Item
                                id="action2"
                                label="Secondary Action"
                                onActivate={() => showTrigger("Menu Action", "Secondary Action triggered")}
                                accels="<Control><Alt>s"
                            />
                        </Menu.Section>
                        <Menu.Section>
                            <Menu.Item
                                id="action3"
                                label="Alternative Trigger Demo"
                                onActivate={() => showTrigger("Menu Action", "Works with F5 or Ctrl+R")}
                                accels={["F5", "<Control>r"]}
                            />
                        </Menu.Section>
                    </GtkMenuButton>
                </GtkBox>
            </GtkFrame>

            {/* Parsing Trigger Strings */}
            <GtkFrame label="Trigger String Parsing">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={8}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="ShortcutTrigger can be created from accelerator strings:"
                        halign={Gtk.Align.START}
                        cssClasses={["heading"]}
                    />
                    <GtkLabel
                        label={`"<Control>s"           - Ctrl+S
"<Control><Shift>s"    - Ctrl+Shift+S
"<Alt>F4"              - Alt+F4
"<Primary>q"           - Platform primary key (Ctrl/Cmd)
"_s"                   - Mnemonic trigger for 's'
"never"                - NeverTrigger
"<Control>a|<Control>b" - Alternative trigger (ShortcutTrigger only)

Note: For menu accels, use an array: accels={["F5", "<Control>r"]}`}
                        halign={Gtk.Align.START}
                        cssClasses={["monospace"]}
                    />
                </GtkBox>
            </GtkFrame>

            {/* Best Practices */}
            <GtkFrame label="Best Practices">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={8}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="1. Use AlternativeTrigger for cross-platform shortcuts (e.g., Ctrl+C on Linux, Cmd+C on macOS)"
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />
                    <GtkLabel
                        label="2. Prefer <Primary> modifier for platform-appropriate behavior"
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />
                    <GtkLabel
                        label="3. Use NeverTrigger to temporarily disable shortcuts"
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />
                    <GtkLabel
                        label="4. Set appropriate scope (LOCAL for widgets, GLOBAL for app-wide)"
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />
                </GtkBox>
            </GtkFrame>

            {/* Focus indicator */}
            <GtkButton label="Click here to focus this demo" onClicked={() => void boxRef.current?.grabFocus()} />
        </GtkBox>
    );
};

export const shortcutTriggersDemo: Demo = {
    id: "shortcut-triggers",
    title: "Shortcut Triggers",
    description: "Advanced shortcut trigger patterns with GtkShortcutController",
    keywords: [
        "shortcut",
        "trigger",
        "keyboard",
        "accelerator",
        "AlternativeTrigger",
        "MnemonicTrigger",
        "NeverTrigger",
        "GtkShortcutController",
        "keybinding",
    ],
    component: ShortcutTriggersDemo,
    sourceCode,
};
